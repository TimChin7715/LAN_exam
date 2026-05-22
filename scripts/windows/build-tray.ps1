param(
    [string]$OutDir = '',
    [switch]$SkipIfMissingDotnet
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) {
    $OutDir = Join-Path $root 'dist\lan-exam-win'
}

$trayProject = Join-Path $root 'tools\lan-exam-tray\LAN-Exam-Tray.csproj'
$publishDir = Join-Path $root 'dist\tray-publish'

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    if ($SkipIfMissingDotnet) {
        Write-Warning 'dotnet SDK not found — skipping LAN-Exam-Tray.exe (install .NET 8 SDK and re-run package.ps1)'
        return
    }
    throw 'dotnet SDK is required to build LAN-Exam-Tray.exe (or pass -SkipIfMissingDotnet)'
}

dotnet publish $trayProject -c Release -o $publishDir
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish LAN-Exam-Tray failed' }
Copy-Item (Join-Path $publishDir 'LAN-Exam-Tray.exe') (Join-Path $OutDir 'LAN-Exam-Tray.exe') -Force
Write-Host "==> LAN-Exam-Tray.exe -> $OutDir"
