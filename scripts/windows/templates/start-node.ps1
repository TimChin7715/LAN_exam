param(
    [Parameter(Mandatory = $true)]
    [string]$InstallHome
)

$ErrorActionPreference = 'Stop'
$InstallHome = $InstallHome.TrimEnd('\')

. (Join-Path $PSScriptRoot 'install-log.ps1')
$ctx = Initialize-InstallLogging -InstallHome $InstallHome -ScriptName 'start-node' -InvokeSource 'runtime'

$logDir = $ctx.Paths.LogDir
$logFile = $ctx.Paths.AppLog
$installLog = $ctx.Paths.InstallLog
$debugLog = Join-Path $logDir 'debug-57b789.log'
$envFile = Join-Path $InstallHome '.env'

#region agent log
function Write-DebugNdjson {
    param([string]$HypothesisId, [string]$Location, [string]$Message, [hashtable]$Data = @{})
    $payload = @{
        sessionId    = '57b789'
        hypothesisId = $HypothesisId
        location     = $Location
        message      = $Message
        data         = $Data
        timestamp    = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    } | ConvertTo-Json -Compress
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::AppendAllText($debugLog, $payload + [Environment]::NewLine, $utf8NoBom)
}
#endregion

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

Write-InstallLogLine -Context $ctx -Level 'STEP' -Message 'start-node begin'

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
$bundleNodeModules = Join-Path $InstallHome 'app\server-bundle\node_modules'
$pnpmNodeModules = Join-Path $bundleNodeModules '.pnpm\node_modules'
$nodePathParts = @($bundleNodeModules)
if (Test-Path $pnpmNodeModules) { $nodePathParts += $pnpmNodeModules }
$env:NODE_PATH = $nodePathParts -join [IO.Path]::PathSeparator

if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = 'postgresql://lan_exam:lan_exam@127.0.0.1:5434/lan_exam'
}

$secret = $env:SESSION_SECRET
if (-not $secret -or $secret.Length -lt 16) {
    throw 'SESSION_SECRET missing or too short in .env — reinstall or regenerate .env'
}

$node = Join-Path $InstallHome 'runtime\node\node.exe'
$appDir = Join-Path $InstallHome 'app'
$serverEntry = Join-Path $appDir 'server-bundle\dist\index.js'

if (-not (Test-Path $node)) {
    Write-InstallLogLine -Context $ctx -Level 'FAIL' -Message "Node runtime not found: $node"
    throw "Node runtime not found: $node"
}
if (-not (Test-Path $serverEntry)) {
    Write-InstallLogLine -Context $ctx -Level 'FAIL' -Message "Server bundle not found: $serverEntry"
    throw "Server bundle not found: $serverEntry"
}
Write-InstallLogLine -Context $ctx -Level 'INFO' -Message "entry=$serverEntry NODE_PATH length=$($env:NODE_PATH.Length)"

function Test-LanExamHealthOk {
    try {
        $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:5180/health' -TimeoutSec 3 -UseBasicParsing
        return $resp.Content -match '"status"\s*:\s*"ok"'
    }
    catch {
        return $false
    }
}

$listenerPids = @(Get-NetTCPConnection -LocalPort 5180 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)
if ($listenerPids.Count -gt 0) {
    if (Test-LanExamHealthOk) {
        Write-InstallLogLine -Context $ctx -Level 'OK' -Message 'port 5180 already serving /health ok — skip start'
        Write-Host '[start-node] Port 5180 already serving LAN Exam — skip'
        exit 0
    }
    Write-Host '[start-node] Port 5180 in use but /health not OK — stopping listeners...'
    foreach ($listenerPid in $listenerPids) {
        $path = try {
            (Get-Process -Id $listenerPid -ErrorAction SilentlyContinue).Path
        }
        catch { $null }
        Write-Host "[start-node] Stop-Process PID $listenerPid $(if ($path) { $path })"
        Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
[System.IO.File]::AppendAllText($logFile, "`n=== start $stamp ===`n", $utf8NoBom)

# Start Node with explicit process env (RedirectStandardError / UseShellExecute=false drops NODE_PATH).
$stderrLog = Join-Path $logDir 'node-stderr.log'
if (Test-Path $stderrLog) { Remove-Item $stderrLog -Force }
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $node
$psi.Arguments = 'server-bundle\dist\index.js'
$psi.WorkingDirectory = $appDir
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardError = $true
# Do not redirect stdout — pino logs can fill the pipe and block Node before :5180 listens.
foreach ($envItem in [Environment]::GetEnvironmentVariables('Process').GetEnumerator()) {
    $psi.EnvironmentVariables[$envItem.Key] = [string]$envItem.Value
}
$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$stderrBuilder = New-Object System.Text.StringBuilder
$proc.add_ErrorDataReceived({
    param($sender, $e)
    if ($e.Data) { [void]$stderrBuilder.AppendLine($e.Data) }
})
if (-not $proc.Start()) {
    throw 'Failed to start Node process'
}
$proc.BeginErrorReadLine()

Start-Sleep -Seconds 5
if ($proc.HasExited) {
    $proc.WaitForExit(2000) | Out-Null
    $stderrTail = $stderrBuilder.ToString().Trim()
    if ($stderrTail) {
        [System.IO.File]::WriteAllText($stderrLog, $stderrTail, $utf8NoBom)
        [System.IO.File]::AppendAllText($logFile, "--- node-stderr.log ---`n$stderrTail`n", $utf8NoBom)
    }
    [System.IO.File]::AppendAllText(
        $logFile,
        "[start-node] Node exited immediately (code $($proc.ExitCode))`n",
        $utf8NoBom
    )
    #region agent log
    Write-DebugNdjson -HypothesisId 'H2' -Location 'start-node.ps1:exit' -Message 'node exited early' -Data @{
        exitCode    = $proc.ExitCode
        databaseUrl = ($env:DATABASE_URL -replace ':[^:@]+@', ':***@')
    }
    #endregion
    Write-InstallLogLine -Context $ctx -Level 'FAIL' -Message "Node exited immediately code=$($proc.ExitCode) see=$logFile node-stderr=$stderrLog"
    throw "Node exited immediately (code $($proc.ExitCode)). See $logFile and $installLog"
}

$listening = Get-NetTCPConnection -LocalPort 5180 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($listening) {
    Write-InstallLogLine -Context $ctx -Level 'OK' -Message "Node listening on :5180 pid=$($proc.Id)"
    Write-Host '[start-node] Node listening on :5180 (PID' $proc.Id ')'
    exit 0
}

$tail = ''
if (Test-Path $logFile) {
    $tail = (Get-Content $logFile -Tail 20 -ErrorAction SilentlyContinue | Out-String).Trim()
}
$stderrTail = $stderrBuilder.ToString().Trim()
if ($stderrTail) {
    [System.IO.File]::WriteAllText($stderrLog, $stderrTail, $utf8NoBom)
    [System.IO.File]::AppendAllText($logFile, "--- node-stderr.log ---`n$stderrTail`n", $utf8NoBom)
}
Write-InstallLogLine -Context $ctx -Level 'FAIL' -Message "port 5180 not listening within 5s pid=$($proc.Id)"
if ($stderrTail) {
    Write-InstallLogOutput -Context $ctx -Label 'node stderr' -Output $stderrTail -LogFile $installLog
}
$msg = "Node did not open port 5180 within 5s (PID $($proc.Id)). See $logFile and $installLog"
if ($tail) { $msg += "`n--- app.log (last lines) ---`n$tail" }
throw $msg
