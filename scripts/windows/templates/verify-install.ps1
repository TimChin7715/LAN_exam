param(
    [Parameter(Mandatory = $true)]
    [string]$InstallHome
)

$ErrorActionPreference = 'Stop'
$InstallHome = $InstallHome.TrimEnd('\')
$ensure = Join-Path $InstallHome 'scripts\ensure-db-ready.ps1'
$installLog = Join-Path $InstallHome 'logs\install.log'

& $ensure -InstallHome $InstallHome
if ($LASTEXITCODE -ne 0) {
    throw "ensure-db-ready failed (exit $LASTEXITCODE)"
}

if (-not (Test-Path $installLog)) {
    throw "Missing install log: $installLog"
}
$logText = Get-Content $installLog -Raw -ErrorAction SilentlyContinue
if ($logText -notmatch 'install completed') {
    throw "install.log does not contain 'install completed'. See $installLog"
}

Write-Host '[verify-install] OK'
exit 0
