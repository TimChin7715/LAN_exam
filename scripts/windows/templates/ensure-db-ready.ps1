param(
    [Parameter(Mandatory = $true)]
    [string]$InstallHome
)

$ErrorActionPreference = 'Stop'
$InstallHome = $InstallHome.TrimEnd('\')
$marker = Join-Path $InstallHome 'data\.install-db-complete'
$installDb = Join-Path $InstallHome 'scripts\install-db.ps1'

if ((Test-Path $marker) -and (Test-Path $installDb)) {
  $pgBin = Join-Path $InstallHome 'runtime\postgres\bin'
  $psql = Join-Path $pgBin 'psql.exe'
  if (Test-Path $psql) {
    $ok = (& $psql -h 127.0.0.1 -p 5434 -U lan_exam -d lan_exam -w -X -tAc `
      "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Teacher'" `
      2>$null | Out-String).Trim()
    if ($ok -eq '1') { exit 0 }
  }
}

Write-Host '[ensure-db-ready] Database not ready — running install-db.ps1...'
& $installDb -InstallHome $InstallHome -InvokeSource 'ensure'
if ($LASTEXITCODE -ne 0) {
  throw "install-db.ps1 failed (exit $LASTEXITCODE). See $InstallHome\logs\install.log"
}
exit 0
