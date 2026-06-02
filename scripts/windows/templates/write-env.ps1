param(
    [Parameter(Mandatory = $true)]
    [string]$InstallHome,
    [string]$InvokeSource = 'unknown'
)

$ErrorActionPreference = 'Stop'
$InstallHome = $InstallHome.TrimEnd('\')
. (Join-Path $PSScriptRoot 'install-log.ps1')
$ctx = Initialize-InstallLogging -InstallHome $InstallHome -ScriptName 'write-env' -InvokeSource $InvokeSource

try {
    Write-InstallLogSessionStart -Context $ctx
    $envPath = Join-Path $InstallHome '.env'
    $hadEnv = Test-Path $envPath

    $secret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
    $content = @"
ADMIN_AUTH_MODE=disabled
LOCAL_ADMIN_USERNAME=local_exam_admin
ADMIN_API_LOOPBACK_ONLY=true
LISTEN_HOST=0.0.0.0
WEB_PORT=5180
DATABASE_URL=postgresql://lan_exam:lan_exam@127.0.0.1:5434/lan_exam
SESSION_SECRET=$secret
NODE_ENV=production
SERVE_WEB=true
WEB_DIST_PATH=
"@
    [System.IO.File]::WriteAllText($envPath, $content, $ctx.Utf8NoBom)

    Write-InstallLogLine -Context $ctx -Level 'INFO' -Message "wrote .env path=$envPath replacedExisting=$hadEnv"
    Write-InstallLogLine -Context $ctx -Level 'INFO' -Message 'env keys: ADMIN_AUTH_MODE=disabled WEB_PORT=5180 DATABASE_URL=postgresql://***@127.0.0.1:5434/lan_exam SESSION_SECRET=<generated len=48>'
    Write-InstallLogSessionEnd -Context $ctx -Success $true
}
catch {
    Write-InstallLogException -Context $ctx -ErrorRecord $_
    Write-InstallLogSessionEnd -Context $ctx -Success $false
    throw
}
