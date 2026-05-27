param(
    [Parameter(Mandatory = $true)]
    [string]$InstallHome
)

$ErrorActionPreference = 'Stop'
$InstallHome = $InstallHome.TrimEnd('\')
$logDir = Join-Path $InstallHome 'logs'
$logFile = Join-Path $logDir 'app.log'
$envFile = Join-Path $InstallHome '.env'

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

if (-not (Test-Path $envFile)) {
    throw ".env not found at $envFile — reinstall or run scripts\write-env.ps1"
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        if ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($name, 'Process'))) {
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }
}

$env:LAN_EXAM_HOME = $InstallHome
$env:NODE_ENV = 'production'
$env:SERVE_WEB = 'true'
$env:WEB_DIST_PATH = Join-Path $InstallHome 'app\web\dist'
$env:NODE_PATH = Join-Path $InstallHome 'app\server-bundle\node_modules'

if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = 'postgresql://lan_exam:lan_exam@127.0.0.1:5434/lan_exam'
}

$secret = $env:SESSION_SECRET
if (-not $secret -or $secret.Length -lt 16) {
    throw 'SESSION_SECRET missing or too short in .env — reinstall or regenerate .env'
}

$node = Join-Path $InstallHome 'runtime\node\node.exe'
$appDir = Join-Path $InstallHome 'app'
$entry = Join-Path $appDir 'server-bundle\dist\index.js'

if (-not (Test-Path $node)) { throw "Node runtime not found: $node" }
if (-not (Test-Path $entry)) { throw "Server bundle not found: $entry" }

$listening = Get-NetTCPConnection -LocalPort 5180 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($listening) {
    Write-Host '[start-node] Port 5180 already listening — skip'
    exit 0
}

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
[System.IO.File]::AppendAllText($logFile, "`n=== start $stamp ===`n", $utf8NoBom)

# Start Node directly (avoid nested cmd.exe — blocked in some elevated/install contexts).
$proc = Start-Process -FilePath $node `
    -ArgumentList @('server-bundle\dist\index.js') `
    -WorkingDirectory $appDir `
    -WindowStyle Minimized `
    -PassThru
if (-not $proc) {
    throw 'Failed to start Node process'
}

Start-Sleep -Seconds 5
if ($proc.HasExited) {
    [System.IO.File]::AppendAllText(
        $logFile,
        "[start-node] Node exited immediately (code $($proc.ExitCode))`n",
        $utf8NoBom
    )
    throw "Node exited immediately (code $($proc.ExitCode)). See $logFile"
}

$listening = Get-NetTCPConnection -LocalPort 5180 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($listening) {
    Write-Host '[start-node] Node listening on :5180 (PID' $proc.Id ')'
    exit 0
}

$tail = ''
if (Test-Path $logFile) {
    $tail = (Get-Content $logFile -Tail 20 -ErrorAction SilentlyContinue | Out-String).Trim()
}
$msg = "Node did not open port 5180 within 5s (PID $($proc.Id)). See $logFile"
if ($tail) { $msg += "`n--- app.log (last lines) ---`n$tail" }
throw $msg
