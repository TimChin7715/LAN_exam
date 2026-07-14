# Assemble offline green package (zip) and optionally Inno Setup installer.
param(
    [string]$OutDir = '',
    [string]$InnoSetupCompiler = '',
    [switch]$WithInstaller,
    [switch]$SkipZip
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) {
    $OutDir = Join-Path $root 'dist\lan-exam-win'
}

$releaseVersion = & (Join-Path $PSScriptRoot 'get-release-version.ps1') -Root $root
Write-Host "==> LAN Exam package v$releaseVersion started at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
if ($WithInstaller) {
    Write-Host '    Stages: build-release -> fetch-runtimes -> trim-runtimes -> tray -> verify -> zip -> Inno (Inno may take 15-30 min)'
}
else {
    Write-Host '    Stages: build-release -> fetch-runtimes -> trim-runtimes -> tray -> verify -> zip'
}

& (Join-Path $PSScriptRoot 'validate-install-scripts.ps1')
& (Join-Path $PSScriptRoot 'cleanup-dist-artifacts.ps1') -Root $root -Version $releaseVersion

Write-Host "==> [1/6] build-release $(Get-Date -Format HH:mm:ss)"
& (Join-Path $PSScriptRoot 'build-release.ps1') -OutDir $OutDir
Write-Host "==> [2/6] fetch-runtimes $(Get-Date -Format HH:mm:ss)"
& (Join-Path $PSScriptRoot 'fetch-runtimes.ps1') -OutDir $OutDir
Write-Host "==> [3/6] trim-runtimes $(Get-Date -Format HH:mm:ss)"
& (Join-Path $PSScriptRoot 'trim-postgres-runtime.ps1') -OutDir $OutDir
& (Join-Path $PSScriptRoot 'trim-node-runtime.ps1') -OutDir $OutDir
Write-Host "==> [4/6] build-tray $(Get-Date -Format HH:mm:ss)"
& (Join-Path $PSScriptRoot 'build-tray.ps1') -OutDir $OutDir -SkipIfMissingDotnet

Write-Host "==> [5/6] verify-package $(Get-Date -Format HH:mm:ss)"
& (Join-Path $PSScriptRoot 'verify-package.ps1') -OutDir $OutDir

if (-not $SkipZip) {
    $distDir = Join-Path $root 'dist'
    $zipName = "LAN-Exam-win-v$releaseVersion.zip"
    $zipPath = Join-Path $distDir $zipName
    $folderName = Split-Path $OutDir -Leaf
    Write-Host "==> [6/6] zip archive $(Get-Date -Format HH:mm:ss)"
    if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    Push-Location $distDir
    try {
        & tar -a -cf $zipName $folderName
        if ($LASTEXITCODE -ne 0) { throw "tar failed (exit $LASTEXITCODE)" }
    }
    finally {
        Pop-Location
    }
    $zipSizeMb = [Math]::Round((Get-Item $zipPath).Length / 1MB, 1)
    Write-Host "==> Green zip: dist\$zipName ($zipSizeMb MB)"
}
Write-Host "==> Green directory: $OutDir"

if (-not $WithInstaller) {
    Write-Host '==> Done (zip only). Pass -WithInstaller to also build LAN-Exam-Setup.exe via Inno Setup.'
    exit 0
}

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

$iss = Join-Path $root 'inno-setup\LAN-Exam.iss'
if (-not (Test-Path $InnoSetupCompiler)) {
    Write-Warning "Inno Setup not found at: $InnoSetupCompiler"
    Write-Warning 'Skipped installer; green zip is ready.'
    exit 0
}

Write-Host "==> [optional] Inno Setup compress $(Get-Date -Format HH:mm:ss) (often 15-30 min)"
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
