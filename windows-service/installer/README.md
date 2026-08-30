# Windows installer

This directory is reserved for the Windows MSI installer definition.

## Design requirements

- Windows 11 x64.
- No Docker.
- No global Node.js dependency at runtime.
- The Windows service is published self-contained.
- The Launchpad Node runtime is provisioned by the installer/build pipeline, not assumed from PATH.
- Installation and data locations are installer properties; they are never hard-coded into application source.
- Personal bookmarks, databases, icons and backups are runtime data and must never be packaged into source control.

## Test installation

The first installer test must be performed on a clean Windows 11 test account or VM.

The test must verify:

1. MSI installs successfully.
2. The service is registered with the Windows Service Control Manager.
3. Service start/stop/restart works.
4. The application starts without a globally installed Node.js runtime.
5. The selected data directory is used.
6. No Docker process is installed or started.
7. Uninstall removes application/service files but does not silently delete the configured data directory.

The MSI itself will be added once the build pipeline can produce and validate the required application payload reproducibly.