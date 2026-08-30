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
        var applicationDirectory = ResolvePath(_configuration["Launchpad:ApplicationDirectory"] ?? throw new InvalidOperationException("Launchpad:ApplicationDirectory is not configured."), serviceBase);
        var nodeExecutable = ResolvePath(_configuration["Launchpad:NodeExecutable"] ?? throw new InvalidOperationException("Launchpad:NodeExecutable is not configured."), serviceBase);
        var arguments = _configuration["Launchpad:Arguments"] ?? throw new InvalidOperationException("Launchpad:Arguments is not configured.");
        var dataDirectory = ResolveDataDirectory(
            _configuration["Launchpad:DataDirectory"],
            Environment.GetEnvironmentVariable("LAUNCHPAD_DATA_DIR"));
        var restartDelay = Math.Max(1, _configuration.GetValue("Launchpad:RestartDelaySeconds", 5));
        var maxRestarts = Math.Max(0, _configuration.GetValue("Launchpad:MaxRestarts", 10));
        var stableRuntimeSeconds = Math.Max(1, _configuration.GetValue("Launchpad:StableRuntimeSeconds", 60));
        var consecutiveRestarts = 0;

        Directory.CreateDirectory(dataDirectory);
        _log.LogInformation("Launchpad service starting. ApplicationDirectory={ApplicationDirectory}, DataDirectory={DataDirectory}", applicationDirectory, dataDirectory);

        while (!stoppingToken.IsCancellationRequested)
        {
            Process? child = null;
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

                foreach (var setting in _configuration.GetSection("Launchpad:Environment").GetChildren())
                    psi.Environment[setting.Key] = setting.Value ?? string.Empty;
                psi.Environment["DATA_DIR"] = dataDirectory;

                child = new Process { StartInfo = psi, EnableRaisingEvents = true };
                child.OutputDataReceived += (_, e) => { if (e.Data != null) _log.LogInformation("{Line}", e.Data); };
                child.ErrorDataReceived += (_, e) => { if (e.Data != null) _log.LogError("{Line}", e.Data); };
                _child = child;

                if (!child.Start()) throw new InvalidOperationException("Could not start Launchpad Node process.");
                child.BeginOutputReadLine();
                child.BeginErrorReadLine();
                var startedAt = Stopwatch.GetTimestamp();
                _log.LogInformation("Launchpad Node process started with PID {Pid}.", child.Id);

                try
                {
                    await child.WaitForExitAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }

                var exitCode = child.ExitCode;
                var uptime = Stopwatch.GetElapsedTime(startedAt);
                if (uptime >= TimeSpan.FromSeconds(stableRuntimeSeconds))
                    consecutiveRestarts = 0;

                consecutiveRestarts++;
                _log.LogWarning("Launchpad process exited with code {ExitCode} after {Uptime}. Restart {Restart}/{MaxRestarts}.", exitCode, uptime, consecutiveRestarts, maxRestarts);
                if (consecutiveRestarts > maxRestarts) break;
                await Task.Delay(TimeSpan.FromSeconds(restartDelay), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                consecutiveRestarts++;
                _log.LogError(ex, "Launchpad supervisor failure. Restart {Restart}/{MaxRestarts}.", consecutiveRestarts, maxRestarts);
                if (consecutiveRestarts > maxRestarts) break;
                await Task.Delay(TimeSpan.FromSeconds(restartDelay), stoppingToken);
            }
            finally
            {
                if (!stoppingToken.IsCancellationRequested && ReferenceEquals(_child, child))
                    _child = null;

                if (!stoppingToken.IsCancellationRequested)
                    child?.Dispose();
            }
        }

        var childToStop = _child;
        _child = null;
        try
        {
            if (childToStop is { HasExited: false })
            {
                _log.LogInformation("Stopping Launchpad Node process PID {Pid}.", childToStop.Id);
                childToStop.Kill(entireProcessTree: true);
                await childToStop.WaitForExitAsync(CancellationToken.None);
            }
        }
        catch (Exception ex) { _log.LogWarning(ex, "Could not cleanly stop Launchpad child process."); }
        finally
        {
            childToStop?.Dispose();
        }
        _log.LogInformation("Launchpad service stopped.");
    }

    private static string ResolvePath(string configuredPath, string serviceBase)
    {
        var expanded = Environment.ExpandEnvironmentVariables(configuredPath);
        if (Path.IsPathRooted(expanded)) return Path.GetFullPath(expanded);
        return Path.GetFullPath(Path.Combine(serviceBase, expanded));
    }

    private static string ResolveDataDirectory(string? configured, string? environmentOverride)
    {
        var selected = !string.IsNullOrWhiteSpace(environmentOverride) ? environmentOverride : configured;
        if (!string.IsNullOrWhiteSpace(selected))
        {
            var expanded = Environment.ExpandEnvironmentVariables(selected);
            if (Path.IsPathRooted(expanded)) return Path.GetFullPath(expanded);
            return Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, expanded));
        }

        var commonAppData = Environment.GetFolderPath(
            Environment.SpecialFolder.CommonApplicationData,
            Environment.SpecialFolderOption.Create);
        return Path.GetFullPath(Path.Combine(commonAppData, "Kletternaut", "Launchpad", "data"));
    }
}
