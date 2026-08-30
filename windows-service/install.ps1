#requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$InstallRoot = 'C:\ProgramData\Kletternaut\Launchpad'
$AppRoot = Join-Path $InstallRoot 'app'
$DataRoot = Join-Path $InstallRoot 'data'
$ServiceRoot = Join-Path $InstallRoot 'service'
$ServiceName = 'KletternautLaunchpad'
$DisplayName = 'Kletternaut Launchpad'

New-Item -ItemType Directory -Force -Path $AppRoot,$DataRoot,$ServiceRoot | Out-Null

Write-Host 'Building Launchpad...'
Push-Location $Root
try {
  npm install
  npm run build
} finally { Pop-Location }

Write-Host 'Copying application...'
robocopy (Join-Path $Root 'server') (Join-Path $AppRoot 'server') /E /XD node_modules dist data | Out-Null
robocopy (Join-Path $Root 'server\dist') (Join-Path $AppRoot 'server\dist') /E | Out-Null
robocopy (Join-Path $Root 'client\dist') (Join-Path $AppRoot 'client\dist') /E | Out-Null
Copy-Item (Join-Path $Root 'server\package.json') (Join-Path $AppRoot 'server\package.json') -Force
Copy-Item (Join-Path $PSScriptRoot 'appsettings.json') (Join-Path $ServiceRoot 'appsettings.json') -Force

Write-Host 'Publishing Windows service...'
dotnet publish (Join-Path $PSScriptRoot 'LaunchpadService.csproj') -c Release -o $ServiceRoot

$exe = Join-Path $ServiceRoot 'LaunchpadService.exe'
if (-not (Test-Path $exe)) { throw "Service executable was not produced: $exe" }

& sc.exe stop $ServiceName | Out-Null
& sc.exe delete $ServiceName | Out-Null
Start-Sleep -Seconds 1

& sc.exe create $ServiceName binPath= "`"$exe`"" start= auto DisplayName= "`"$DisplayName`""
& sc.exe description $ServiceName 'Self-hosted Launchpad bookmark service. Bookmark data remains local.'
& sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
& sc.exe start $ServiceName

Write-Host ""
Write-Host "Installed: $DisplayName"
Write-Host "Data:      $DataRoot"
Write-Host "Service:   $ServiceName"
Write-Host "Control:   services.msc / sc.exe"
