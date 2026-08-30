#requires -RunAsAdministrator
[CmdletBinding()]
param(
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Kletternaut\Launchpad'),
    [string]$DataRoot = (Join-Path $env:LOCALAPPDATA 'Kletternaut\Launchpad\data'),
    [string]$ServiceName = 'KletternautLaunchpad',
    [ValidateSet('Automatic','Manual','Disabled')]
    [string]$StartupType = 'Automatic',
    [string]$HostAddress = '127.0.0.1',
    [int]$Port = 3021,
    [string]$AllowedOrigins = ''
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$AppRoot = Join-Path $InstallRoot 'app'
$ServiceRoot = Join-Path $InstallRoot 'service'
$ConfigRoot = Join-Path $InstallRoot 'config'

New-Item -ItemType Directory -Force -Path $AppRoot,$DataRoot,$ServiceRoot,$ConfigRoot | Out-Null

Write-Host "Installationsverzeichnis: $InstallRoot"
Write-Host "Datenverzeichnis:         $DataRoot"
Write-Host "Host:                     $HostAddress"
Write-Host "Port:                     $Port"
Write-Host "Docker:                   nicht verwendet"

Push-Location $Root
try {
    npm install
    npm run build
} finally { Pop-Location }

robocopy (Join-Path $Root 'server') (Join-Path $AppRoot 'server') /E /XD node_modules dist data | Out-Null
robocopy (Join-Path $Root 'server\dist') (Join-Path $AppRoot 'server\dist') /E | Out-Null
robocopy (Join-Path $Root 'client\dist') (Join-Path $AppRoot 'client\dist') /E | Out-Null
Copy-Item (Join-Path $Root 'server\package.json') (Join-Path $AppRoot 'server\package.json') -Force

$configPath = Join-Path $ConfigRoot 'appsettings.json'
$config = [ordered]@{
    Launchpad = [ordered]@{
        NodeExecutable = 'node.exe'
        WorkingDirectory = $AppRoot
        Arguments = 'server\dist\index.js'
        DataDirectory = $DataRoot
        RestartDelaySeconds = 5
        MaxRestarts = 10
        Environment = [ordered]@{
            NODE_ENV = 'production'
            PORT = [string]$Port
            HOST = $HostAddress
            DATA_DIR = $DataRoot
            ALLOWED_ORIGINS = $AllowedOrigins
        }
    }
}
$config | ConvertTo-Json -Depth 6 | Set-Content -Path $configPath -Encoding UTF8

Push-Location $PSScriptRoot
try {
    dotnet publish (Join-Path $PSScriptRoot 'LaunchpadService.csproj') -c Release -o $ServiceRoot
} finally { Pop-Location }

$exe = Join-Path $ServiceRoot 'LaunchpadService.exe'
if (-not (Test-Path $exe)) { throw "Service executable was not produced: $exe" }

& sc.exe stop $ServiceName 2>$null | Out-Null
& sc.exe delete $ServiceName 2>$null | Out-Null
Start-Sleep -Seconds 1

$binPath = '"{0}" --config "{1}"' -f $exe, $configPath
& sc.exe create $ServiceName binPath= $binPath start= $StartupType DisplayName= 'Kletternaut Launchpad'
& sc.exe description $ServiceName 'Self-hosted Launchpad bookmark service; bookmark data remains local.'
& sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null

if ($StartupType -eq 'Automatic') { & sc.exe start $ServiceName | Out-Null }

Write-Host ''
Write-Host 'Installation abgeschlossen.'
Write-Host "Konfiguration: $configPath"
Write-Host "Daten:          $DataRoot"
Write-Host "Dienst:         $ServiceName"
Write-Host 'Steuerung:      services.msc / sc.exe'
