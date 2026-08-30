# Windows service deployment

This directory provides a Windows Service host for Launchpad. The service is separate from the Node application and is controlled by the Windows Service Control Manager.

## Privacy boundary

The Git repository contains application source only. Do **not** commit `server/data`, `*.db`, icon caches, Brave bookmark exports, or backups. The runtime data directory is outside the repository:

`C:\ProgramData\Kletternaut\Launchpad\data`

## Service control

After installation, use `services.msc` or `sc.exe`:

```powershell
sc.exe query KletternautLaunchpad
sc.exe stop KletternautLaunchpad
sc.exe start KletternautLaunchpad
```

Windows is responsible for service startup and recovery. The service host additionally supervises the Node child process and can restart it according to `appsettings.json`.

## Configuration

Edit `C:\ProgramData\Kletternaut\Launchpad\service\appsettings.json` and restart the service. Important values include:

- `NodeExecutable`
- `WorkingDirectory`
- `Arguments`
- `RestartDelaySeconds`
- `MaxRestarts`
- `PORT`
- `DATA_DIR`
- `ALLOWED_ORIGINS`

No bookmark data is needed during development or GitHub builds.
