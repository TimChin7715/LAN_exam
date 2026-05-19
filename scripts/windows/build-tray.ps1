param(
    [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) {
    $OutDir = Join-Path $root 'dist\lan-exam-win'
}

$trayProject = Join-Path $root 'tools\lan-exam-tray\LAN-Exam-Tray.csproj'
$publishDir = Join-Path $root 'dist\tray-publish'

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw 'dotnet SDK is required to build LAN-Exam-Tray.exe'
}

dotnet publish $trayProject -c Release -o $publishDir
Copy-Item (Join-Path $publishDir 'LAN-Exam-Tray.exe') (Join-Path $OutDir 'LAN-Exam-Tray.exe') -Force
Write-Host "==> LAN-Exam-Tray.exe -> $OutDir"
