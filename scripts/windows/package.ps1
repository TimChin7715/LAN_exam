# Assemble full offline installer via Inno Setup.
param(
    [string]$OutDir = '',
    [string]$InnoSetupCompiler = ''
)

if (-not $InnoSetupCompiler) {
    $innoCandidates = @(
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
        "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
    )
    foreach ($candidate in $innoCandidates) {
        if (Test-Path $candidate) {
            $InnoSetupCompiler = $candidate
            break
        }
    }
    if (-not $InnoSetupCompiler) {
        $InnoSetupCompiler = 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe'
    }
}

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) {
    $OutDir = Join-Path $root 'dist\lan-exam-win'
}

$releaseVersion = & (Join-Path $PSScriptRoot 'get-release-version.ps1') -Root $root
Write-Host "==> LAN Exam package v$releaseVersion started at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host '    Stages: build-release -> fetch-runtimes -> tray -> verify -> Inno (Inno may take 15-30 min with little output)'

& (Join-Path $PSScriptRoot 'validate-install-scripts.ps1')

Write-Host "==> [1/5] build-release $(Get-Date -Format HH:mm:ss)"
& (Join-Path $PSScriptRoot 'build-release.ps1') -OutDir $OutDir
Write-Host "==> [2/5] fetch-runtimes $(Get-Date -Format HH:mm:ss)"
& (Join-Path $PSScriptRoot 'fetch-runtimes.ps1') -OutDir $OutDir
Write-Host "==> [3/5] build-tray $(Get-Date -Format HH:mm:ss)"
& (Join-Path $PSScriptRoot 'build-tray.ps1') -OutDir $OutDir -SkipIfMissingDotnet

Write-Host "==> [4/5] verify-package $(Get-Date -Format HH:mm:ss)"
& (Join-Path $PSScriptRoot 'verify-package.ps1') -OutDir $OutDir

$iss = Join-Path $root 'inno-setup\LAN-Exam.iss'
if (-not (Test-Path $InnoSetupCompiler)) {
    Write-Warning "Inno Setup not found at: $InnoSetupCompiler"
    Write-Warning "Green package is ready at: $OutDir"
    Write-Warning "Install Inno Setup 6 and run: ISCC.exe `"$iss`""
    exit 0
}

Write-Host "==> [5/5] Inno Setup compress $(Get-Date -Format HH:mm:ss) (please wait, often 15-30 min)"
$appVersionFull = if ($releaseVersion -match '^\d+\.\d+\.\d+\.\d+$') {
    $releaseVersion
} else {
    "$releaseVersion.0"
}

& $InnoSetupCompiler `
    "/DSourceDir=$OutDir" `
    "/DAppVersion=$releaseVersion" `
    "/DAppVersionFull=$appVersionFull" `
    $iss

$setupName = "LAN-Exam-Setup-v$releaseVersion.exe"
Write-Host "==> Installer: dist\$setupName"
