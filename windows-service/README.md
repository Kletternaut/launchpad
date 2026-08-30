# Windows service deployment

This directory provides a Windows Service host for Launchpad. The service is separate from the Node application and is controlled by the Windows Service Control Manager.

## Privacy boundary

The Git repository contains application source only. Do **not** commit `server/data`, `*.db`, icon caches, Brave bookmark exports, or backups.

Runtime data is kept outside the repository. By default the service uses the Windows `CommonApplicationData` known folder and derives its application-specific subdirectory at runtime. The location can be overridden with the `LAUNCHPAD_DATA_DIR` environment variable or `Launchpad:DataDirectory` in the service configuration.

## Service control

After installation, use `services.msc` or `sc.exe`:

```powershell
sc.exe query KletternautLaunchpad
sc.exe stop KletternautLaunchpad
sc.exe start KletternautLaunchpad
```

Windows is responsible for service startup and recovery. The service host additionally supervises the Node child process and can restart it according to `appsettings.json`.

## Configuration

`appsettings.json` is deployed next to the Windows service executable. Relative paths are resolved from `AppContext.BaseDirectory`; Windows environment variables are expanded before use.

Important values include:

- `Launchpad:ApplicationDirectory`
- `Launchpad:NodeExecutable`
- `Launchpad:Arguments`
- `Launchpad:DataDirectory`
- `Launchpad:RestartDelaySeconds`
- `Launchpad:MaxRestarts`
- `Launchpad:Environment:PORT`
- `Launchpad:Environment:HOST`
- `Launchpad:Environment:ALLOWED_ORIGINS`

`LAUNCHPAD_DATA_DIR` takes precedence over the JSON data-directory setting. The service passes the resolved directory to the Node application as `DATA_DIR`.

No bookmark data is needed during development or GitHub builds.
