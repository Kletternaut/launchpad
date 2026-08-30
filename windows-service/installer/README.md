# Windows MSI installer

The installer is built with WiX Toolset 7.

## Design

- Windows 11 x64.
- No Docker.
- The .NET Windows service is self-contained.
- The Node.js runtime is bundled by the build pipeline; the installed service does not depend on a global `node.exe` in `PATH`.
- The MSI installs application files under the user-selected installation directory.
- Runtime data is outside the application payload and is never committed to Git.
- The MSI registers the service with the Windows Service Control Manager and removes the service on uninstall.

## Build contract

The MSI build consumes a prepared `PayloadRoot` directory.

Expected payload:

```text
PayloadRoot/
  service/LaunchpadService.exe
  runtime/node.exe
  app/client/...
  app/server/...
```

The build pipeline is responsible for producing and validating this payload before invoking WiX.

## Test gate

Do not use this branch for real bookmarks until the CI workflow has produced an MSI successfully and the MSI has passed installation tests on Windows 11.

The first manual test must verify:

1. MSI installs successfully.
2. Installation directory can be selected.
3. Service `KletternautLaunchpad` is registered.
4. Service starts and stops cleanly.
5. Application starts without a global Node.js installation.
6. Data location is outside the application payload.
7. No Docker component is installed or started.
8. Uninstall removes application/service files without silently deleting user data.
