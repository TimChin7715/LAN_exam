# Assemble full offline installer via Inno Setup.
param(
    [string]$OutDir = '',
    [string]$InnoSetupCompiler = 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe'
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) {
    $OutDir = Join-Path $root 'dist\lan-exam-win'
}

& (Join-Path $PSScriptRoot 'build-release.ps1') -OutDir $OutDir
& (Join-Path $PSScriptRoot 'fetch-runtimes.ps1') -OutDir $OutDir
& (Join-Path $PSScriptRoot 'build-tray.ps1') -OutDir $OutDir

$iss = Join-Path $root 'inno-setup\LAN-Exam.iss'
if (-not (Test-Path $InnoSetupCompiler)) {
    Write-Warning "Inno Setup not found at: $InnoSetupCompiler"
    Write-Warning "Green package is ready at: $OutDir"
    Write-Warning "Install Inno Setup 6 and run: ISCC.exe `"$iss`""
    exit 0
}

& $InnoSetupCompiler "/DSourceDir=$OutDir" $iss
Write-Host "==> Installer output in dist\"
