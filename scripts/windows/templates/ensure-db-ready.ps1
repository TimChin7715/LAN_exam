param(
    [Parameter(Mandatory = $true)]
    [string]$InstallHome
)

$ErrorActionPreference = 'Stop'
$InstallHome = $InstallHome.TrimEnd('\')
. (Join-Path $PSScriptRoot 'install-log.ps1')
$ctx = Initialize-InstallLogging -InstallHome $InstallHome -ScriptName 'ensure-db-ready' -InvokeSource 'runtime'

function Ensure-InstallDbCompleteMarker {
    param([string]$InstallHome)
    $marker = Join-Path $InstallHome 'data\.install-db-complete'
    if (-not (Test-Path $marker)) {
        New-Item -ItemType File -Path $marker -Force | Out-Null
        Write-InstallLogLine -Context $ctx -Level 'INFO' -Message "created marker $marker"
    }
}

try {
    Write-InstallLogSessionStart -Context $ctx
    if (-not $ctx.IsAdmin) {
        Write-InstallLogLine -Context $ctx -Level 'WARN' -Message 'not running as Administrator — port cleanup / pg_ctl may fail; prefer install.bat or Setup'
    }
    $marker = Join-Path $InstallHome 'data\.install-db-complete'
    $installDb = Join-Path $InstallHome 'scripts\install-db.ps1'
    Test-InstallPathLogged -Context $ctx -Label 'install-db script' -Path $installDb | Out-Null

    if (Test-LanExamTeacherTable -InstallHome $InstallHome) {
        Ensure-InstallDbCompleteMarker -InstallHome $InstallHome
        Write-InstallLogLine -Context $ctx -Level 'OK' -Message 'database ready (Teacher table exists)'
        Write-InstallLogSessionEnd -Context $ctx -Success $true
        exit 0
    }

    Write-InstallLogLine -Context $ctx -Level 'INFO' -Message "marker=$marker exists=$(Test-Path $marker) Teacher=missing — need install-db"
    Write-InstallLogLine -Context $ctx -Level 'STEP' -Message 'invoking install-db.ps1'
    & $installDb -InstallHome $InstallHome -InvokeSource 'ensure-db-ready'
    if ($LASTEXITCODE -ne 0) {
        throw "install-db.ps1 failed (exit $LASTEXITCODE). See $($ctx.Paths.InstallLog)"
    }
    Write-InstallLogSessionEnd -Context $ctx -Success $true
    exit 0
}
catch {
    Write-InstallLogException -Context $ctx -ErrorRecord $_
    Write-InstallLogSessionEnd -Context $ctx -Success $false
    throw
}
