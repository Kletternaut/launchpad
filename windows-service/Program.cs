using System.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var configPath = GetConfigPath(args);
var builder = Host.CreateApplicationBuilder(args);
if (!string.IsNullOrWhiteSpace(configPath))
    builder.Configuration.AddJsonFile(configPath, optional: false, reloadOnChange: true);

builder.Services.AddWindowsService(options => options.ServiceName = "Kletternaut Launchpad");
builder.Services.AddHostedService<LaunchpadWorker>();
await builder.Build().RunAsync();

static string? GetConfigPath(string[] args)
{
    for (var i = 0; i < args.Length - 1; i++)
        if (string.Equals(args[i], "--config", StringComparison.OrdinalIgnoreCase))
            return Path.GetFullPath(Environment.ExpandEnvironmentVariables(args[i + 1]));
    return null;
}

public sealed class LaunchpadWorker : BackgroundService
{
    private readonly ILogger<LaunchpadWorker> _log;
    private readonly IConfiguration _configuration;
    private Process? _child;

    public LaunchpadWorker(ILogger<LaunchpadWorker> log, IConfiguration configuration)
    {
        _log = log;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var node = _configuration["Launchpad:NodeExecutable"] ?? "node.exe";
        var workingDirectory = ResolveConfiguredPath(_configuration["Launchpad:WorkingDirectory"], "%SERVICE_BASE%\\app");
        var arguments = _configuration["Launchpad:Arguments"] ?? "server\\dist\\index.js";
        var dataDirectory = ResolveConfiguredPath(_configuration["Launchpad:DataDirectory"], "%ProgramData%\\Kletternaut\\Launchpad\\data");
        var restartDelay = _configuration.GetValue("Launchpad:RestartDelaySeconds", 5);
        var maxRestarts = _configuration.GetValue("Launchpad:MaxRestarts", 10);
        var restarts = 0;

        Directory.CreateDirectory(dataDirectory);
        _log.LogInformation("Launchpad service starting. WorkingDirectory={WorkingDirectory}, DataDirectory={DataDirectory}", workingDirectory, dataDirectory);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = node,
                    Arguments = arguments,
                    WorkingDirectory = workingDirectory,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                };

                foreach (var child in _configuration.GetSection("Launchpad:Environment").GetChildren())
                    psi.Environment[child.Key] = child.Value ?? string.Empty;
                psi.Environment["DATA_DIR"] = dataDirectory;

                _child = new Process { StartInfo = psi, EnableRaisingEvents = true };
                _child.OutputDataReceived += (_, e) => { if (e.Data != null) _log.LogInformation("{Line}", e.Data); };
                _child.ErrorDataReceived += (_, e) => { if (e.Data != null) _log.LogError("{Line}", e.Data); };
                if (!_child.Start()) throw new InvalidOperationException("Could not start Launchpad Node process.");
                _child.BeginOutputReadLine();
                _child.BeginErrorReadLine();
                _log.LogInformation("Launchpad Node process started with PID {Pid}.", _child.Id);
                restarts = 0;

                await _child.WaitForExitAsync(stoppingToken);
                if (stoppingToken.IsCancellationRequested) break;

                restarts++;
                _log.LogWarning("Launchpad process exited with code {ExitCode}. Restart {Restart}/{MaxRestarts}.", _child.ExitCode, restarts, maxRestarts);
                if (restarts > maxRestarts) break;
                await Task.Delay(TimeSpan.FromSeconds(restartDelay), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                restarts++;
                _log.LogError(ex, "Launchpad supervisor failure. Restart {Restart}/{MaxRestarts}.", restarts, maxRestarts);
                if (restarts > maxRestarts) break;
                await Task.Delay(TimeSpan.FromSeconds(restartDelay), stoppingToken);
            }
            finally
            {
                _child?.Dispose();
                _child = null;
            }
        }

        try
        {
            if (_child is { HasExited: false })
            {
                _log.LogInformation("Stopping Launchpad Node process PID {Pid}.", _child.Id);
                _child.Kill(entireProcessTree: true);
                await _child.WaitForExitAsync(CancellationToken.None);
            }
        }
        catch (Exception ex) { _log.LogWarning(ex, "Could not cleanly stop Launchpad child process."); }
        _log.LogInformation("Launchpad service stopped.");
    }

    private static string ResolveConfiguredPath(string? configuredPath, string defaultTemplate)
    {
        var value = string.IsNullOrWhiteSpace(configuredPath) ? defaultTemplate : configuredPath;
        value = value.Replace("%SERVICE_BASE%", AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar), StringComparison.OrdinalIgnoreCase);
        value = Environment.ExpandEnvironmentVariables(value);
        return Path.GetFullPath(value);
    }
}
