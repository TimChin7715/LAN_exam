# Run in your IDE terminal (e.g. PID 13260): .\scripts\windows\package-in-terminal.ps1
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $root
$ver = (Get-Content (Join-Path $root 'VERSION') -Raw).Trim()
$log = Join-Path $root "dist\package-$ver.log"
New-Item -ItemType Directory -Path (Join-Path $root 'dist') -Force | Out-Null
Write-Host "==> Packaging LAN Exam (see $log)"
& (Join-Path $PSScriptRoot 'package.ps1') *>&1 | Tee-Object -FilePath $log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$zip = Join-Path $root "dist\LAN-Exam-win-v$ver.zip"
if (Test-Path $zip) {
    Write-Host "==> Done: $zip"
} else {
    Write-Warning "package.ps1 finished but zip not found: $zip"
}
$setup = Join-Path $root "dist\LAN-Exam-Setup-v$ver.exe"
if (Test-Path $setup) {
    Write-Host "==> Also built installer: $setup"
}
