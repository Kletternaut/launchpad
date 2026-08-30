using System.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var builder = Host.CreateApplicationBuilder(args);
builder.Configuration.SetBasePath(AppContext.BaseDirectory);
builder.Configuration.AddJsonFile("appsettings.json", optional: false, reloadOnChange: true);
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "KletternautLaunchpad";
});
builder.Services.AddHostedService<LaunchpadWorker>();
await builder.Build().RunAsync();

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
        var serviceBase = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var applicationDirectory = ResolvePath(_configuration["Launchpad:ApplicationDirectory"] ?? "app", serviceBase);
        var nodeExecutable = ResolvePath(_configuration["Launchpad:NodeExecutable"] ?? Path.Combine("runtime", "node.exe"), serviceBase);
        var arguments = _configuration["Launchpad:Arguments"] ?? Path.Combine("server", "dist", "index.js");
        var dataDirectory = ResolveDataDirectory(_configuration["Launchpad:DataDirectory"]);
        var restartDelay = Math.Max(1, _configuration.GetValue("Launchpad:RestartDelaySeconds", 5));
        var maxRestarts = Math.Max(0, _configuration.GetValue("Launchpad:MaxRestarts", 10));
        var restarts = 0;

        Directory.CreateDirectory(dataDirectory);
        _log.LogInformation("Launchpad service starting. ApplicationDirectory={ApplicationDirectory}, DataDirectory={DataDirectory}", applicationDirectory, dataDirectory);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = nodeExecutable,
                    Arguments = arguments,
                    WorkingDirectory = applicationDirectory,
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

                var exitCode = _child.ExitCode;
                restarts++;
                _log.LogWarning("Launchpad process exited with code {ExitCode}. Restart {Restart}/{MaxRestarts}.", exitCode, restarts, maxRestarts);
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

    private static string ResolvePath(string configuredPath, string serviceBase)
    {
        var expanded = Environment.ExpandEnvironmentVariables(configuredPath);
        if (Path.IsPathRooted(expanded)) return Path.GetFullPath(expanded);
        return Path.GetFullPath(Path.Combine(serviceBase, expanded));
    }

    private static string ResolveDataDirectory(string? configured)
    {
        if (!string.IsNullOrWhiteSpace(configured))
        {
            var expanded = Environment.ExpandEnvironmentVariables(configured);
            if (Path.IsPathRooted(expanded)) return Path.GetFullPath(expanded);
            return Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, expanded));
        }

        var commonAppData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData, Environment.SpecialFolderOption.Create);
        return Path.GetFullPath(Path.Combine(commonAppData, "Kletternaut", "Launchpad", "data"));
    }
}
