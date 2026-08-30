[CmdletBinding()]
param(
    [string]$OutputRoot = (Join-Path $PSScriptRoot 'build'),
    [string]$ProductVersion = '0.1.0.0'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$payload = Join-Path $OutputRoot 'payload'
$nodeVersion = '24.20.0'

function Assert-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

Assert-Command 'node'
Assert-Command 'npm'
Assert-Command 'dotnet'

if ((node --version) -ne "v$nodeVersion") {
    throw "Build requires Node.js v$nodeVersion. Found $(node --version)."
}

Remove-Item -Recurse -Force $OutputRoot -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $payload | Out-Null

Push-Location $repoRoot
try {
    npm ci
    npm run build
    npm test
    npm prune --omit=dev

    New-Item -ItemType Directory -Force -Path "$payload/app/client", "$payload/app/server", "$payload/runtime", "$payload/service" | Out-Null
    Copy-Item -Recurse -Force 'client/dist' "$payload/app/client/dist"
    Copy-Item -Recurse -Force 'server/dist' "$payload/app/server/dist"
    Copy-Item -Recurse -Force 'server/node_modules' "$payload/app/server/node_modules"
    Copy-Item 'server/package.json' "$payload/app/server/package.json"

    dotnet publish 'windows-service/LaunchpadService.csproj' -c Release -r win-x64 --self-contained true -o "$payload/service"

    $archive = "node-v$nodeVersion-win-x64.zip"
    $temp = Join-Path $env:TEMP $archive
    $url = "https://nodejs.org/download/release/v$nodeVersion/$archive"
    $shaUrl = "https://nodejs.org/download/release/v$nodeVersion/SHASUMS256.txt"
    $shaFile = Join-Path $env:TEMP 'launchpad-node-shasums.txt'

    Invoke-WebRequest -Uri $url -OutFile $temp
    Invoke-WebRequest -Uri $shaUrl -OutFile $shaFile
    $expected = $null
    foreach ($line in Get-Content -Path $shaFile -Encoding ascii) {
        if ($line -match '^(?<hash>[0-9a-fA-F]{64})\s+\*?' + [regex]::Escape($archive) + '$') {
            $expected = $Matches['hash']
            break
        }
    }
    if ([string]::IsNullOrWhiteSpace($expected)) {
        throw "Could not find Node.js archive checksum for $archive."
    }
    $actual = (Get-FileHash -Algorithm SHA256 -Path $temp).Hash
    if (-not [string]::Equals($actual, $expected, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Node.js archive checksum mismatch."
    }

    $nodeExtract = Join-Path $env:TEMP 'launchpad-node-runtime'
    Remove-Item -Recurse -Force $nodeExtract -ErrorAction SilentlyContinue
    Expand-Archive -Path $temp -DestinationPath $nodeExtract
    Copy-Item "$nodeExtract/node-v$nodeVersion-win-x64/node.exe" "$payload/runtime/node.exe"

    foreach ($required in @(
        "$payload/service/LaunchpadService.exe",
        "$payload/service/appsettings.json",
        "$payload/app/server/dist/index.js",
        "$payload/app/client/dist/index.html",
        "$payload/runtime/node.exe"
    )) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
            throw "Required payload file is missing: $required"
        }
    }

    dotnet build 'windows-service/installer/LaunchpadInstaller.wixproj' -c Release `
        -p:PayloadRoot="$payload" `
        -p:InstallerPlatform=x64 `
        -p:ProductVersion=$ProductVersion
}
finally {
    Pop-Location
}

Write-Host "MSI build completed. Check windows-service/installer/bin for the MSI."