param(
    [Parameter(Mandatory = $true)]
    [string]$InstallHome,
    [string]$InvokeSource = 'unknown'
)

$ErrorActionPreference = 'Stop'
$InstallHome = $InstallHome.TrimEnd('\')
$env:LAN_EXAM_HOME = $InstallHome

. (Join-Path $PSScriptRoot 'install-log.ps1')
$ctx = Initialize-InstallLogging -InstallHome $InstallHome -ScriptName 'install-db' -InvokeSource $InvokeSource

$node = Join-Path $InstallHome 'runtime\node\node.exe'
$pgBin = Join-Path $InstallHome 'runtime\postgres\bin'
$pgData = Join-Path $InstallHome 'data\pg'
$logDir = $ctx.Paths.LogDir
$app = Join-Path $InstallHome 'app'
$envFile = Join-Path $InstallHome '.env'
$installLog = $ctx.Paths.InstallLog
$debugLog = Join-Path $logDir 'debug-57b789.log'
$completeMarker = Join-Path $InstallHome 'data\.install-db-complete'
$installDbLockPath = Join-Path $InstallHome 'data\.install-db.lock'
$script:InstallDbLockStream = $null

function Enter-InstallDbLock {
    $lockDir = Split-Path $installDbLockPath -Parent
    if (-not (Test-Path $lockDir)) {
        New-Item -ItemType Directory -Path $lockDir -Force | Out-Null
    }
    $deadline = (Get-Date).AddSeconds(120)
    while ((Get-Date) -lt $deadline) {
        try {
            $script:InstallDbLockStream = [System.IO.File]::Open(
                $installDbLockPath,
                [System.IO.FileMode]::OpenOrCreate,
                [System.IO.FileAccess]::ReadWrite,
                [System.IO.FileShare]::None)
            Write-InstallLogLine -Context $ctx -Level 'INFO' -Message 'acquired install-db lock'
            return
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }
    throw 'Another install-db.ps1 is already running (waited 120s). Close other installers or stop duplicate PowerShell install scripts.'
}

function Exit-InstallDbLock {
    if ($null -eq $script:InstallDbLockStream) { return }
    try {
        $script:InstallDbLockStream.Close()
        $script:InstallDbLockStream.Dispose()
    }
    catch { }
    $script:InstallDbLockStream = $null
}

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

function Write-InstallLog {
    param([string]$Path, [object]$Output)
    if ($null -eq $Output) { return }
    $text = (@($Output) | ForEach-Object { "$_" }) -join [Environment]::NewLine
    if (-not $text.Trim()) { return }
    if ($Path -eq $ctx.Paths.InstallLog) {
        foreach ($line in ($text -split "`r?`n")) {
            $msg = $line.Trim()
            if (-not $msg) { continue }
            if ($msg -match '^\[install-db\]\s*(.+)$') { $msg = $matches[1] }
            $level = 'INFO'
            if ($msg -match 'FATAL|failed \(exit') { $level = 'ERROR' }
            elseif ($msg -match 'WARNING') { $level = 'WARN' }
            elseif ($msg -match 'install completed|start-node OK|database setup completed') { $level = 'OK' }
            Write-InstallLogLine -Context $ctx -Level $level -Message $msg
        }
        return
    }
    [System.IO.File]::AppendAllText($Path, $text + [Environment]::NewLine, $ctx.Utf8NoBom)
}

function Get-ListenerPidsOnPort {
    param([int]$Port)
    $pids = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
    if ($pids.Count -gt 0) { return $pids }
    $lines = netstat -ano | Select-String ":$Port\s" | Select-String 'LISTENING'
    foreach ($line in $lines) {
        $parts = ($line.ToString().Trim() -split '\s+')
        if ($parts.Count -ge 1) {
            $pids += [int]$parts[-1]
        }
    }
    return @($pids | Select-Object -Unique)
}

function Get-ProcessPathSafe {
    param([int]$ProcessId)
    $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($proc) {
        try {
            if ($proc.Path) { return $proc.Path }
        }
        catch { }
    }
    $wmi = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
    if ($wmi -and $wmi.ExecutablePath) { return $wmi.ExecutablePath }
    return $null
}

function Clear-PortForInstall {
    param([int]$Port)
    $expectedPg = (Join-Path $pgBin 'postgres.exe').ToLowerInvariant()
    $deadline = (Get-Date).AddSeconds(45)
    while ((Get-Date) -lt $deadline) {
        $pids = @(Get-ListenerPidsOnPort -Port $Port)
        if ($pids.Count -eq 0) { return }

        foreach ($procId in $pids) {
            $path = Get-ProcessPathSafe -ProcessId $procId
            $pathNote = if ($path) { $path } else { "PID $procId" }
            if ($Port -eq 5434 -and $path -and $path.ToLowerInvariant() -eq $expectedPg) {
                if (Test-Path (Join-Path $pgData 'PG_VERSION')) {
                    Write-Host ('[install-db] Stopping bundled Postgres (PID {0})...' -f $procId)
                    Write-InstallLog -Path $installLog -Output ('[install-db] pg_ctl stop before reclaim port {0}' -f $Port)
                    $pgCtl = Join-Path $pgBin 'pg_ctl.exe'
                    $stopOut = & $pgCtl -D $pgData -w -t 20 stop -m fast 2>&1
                    Write-InstallLog -Path $installLog -Output $stopOut
                }
            }
            Write-Host ('[install-db] Port {0} in use by {1} - terminating PID {2}' -f $Port, $pathNote, $procId)
            Write-InstallLog -Path $installLog -Output ('[install-db] Stop-Process port={0} pid={1} path={2}' -f $Port, $procId, $pathNote)
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 1
    }
    $remaining = @(Get-ListenerPidsOnPort -Port $Port)
    if ($remaining.Count -gt 0) {
        throw "Port $Port still in use (PIDs: $($remaining -join ', ')). Stop those processes or run the installer as Administrator."
    }
}

function Clear-InstallPorts {
    Write-Host 'install-db: Releasing ports 5180 / 5434 for install...'
    Write-InstallLog -Path $installLog -Output 'install-db: clear ports 5180,5434'
    Clear-PortForInstall -Port 5180
    if (Test-PostgresPortListening) {
        Write-InstallLogLine -Context $ctx -Level 'OK' -Message 'Postgres already accepting connections — skip stop-postgres'
        return
    }
    $stopPg = Join-Path $InstallHome 'scripts\stop-postgres.ps1'
    if (Test-Path $stopPg) {
        Write-Host 'install-db: Stopping existing LAN Exam Postgres (if any)...'
        $stopPgOut = & $stopPg -InstallHome $InstallHome 2>&1
        Write-InstallLog -Path $installLog -Output $stopPgOut
    }
    Clear-PortForInstall -Port 5434
}

function Test-PostgresPortListening {
    return Test-PostgresIsReady -InstallHome $InstallHome
}

function Remove-StalePostmasterPid {
    $pidFile = Join-Path $pgData 'postmaster.pid'
    if (-not (Test-Path $pidFile)) { return }
    if (Test-PostgresPortListening) { return }
    Write-InstallLogLine -Context $ctx -Level 'WARN' -Message "removing stale postmaster.pid (no listener on 5434): $pidFile"
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

function Write-PostgresLogTail {
    param([int]$Lines = 30)
    $pgLog = Join-Path $logDir 'postgres.log'
    if (-not (Test-Path $pgLog)) { return }
    $tail = Get-Content $pgLog -Tail $Lines -ErrorAction SilentlyContinue
    Write-InstallLogOutput -Context $ctx -Label 'postgres.log tail' -Output $tail
}

function Start-PostgresIfNeeded {
    if (Test-PostgresPortListening) {
        Write-InstallLogLine -Context $ctx -Level 'OK' -Message 'Postgres already accepting connections on 127.0.0.1:5434 (skip pg_ctl)'
        return
    }

    if (-not (Test-Path (Join-Path $pgData 'PG_VERSION'))) {
        throw 'Postgres data not initialized. initdb should have run first.'
    }

    Remove-StalePostmasterPid

    Write-Host '[install-db] Starting Postgres on 127.0.0.1:5434...'
    Write-InstallLogLine -Context $ctx -Level 'STEP' -Message 'pg_ctl start (-Wait, server log via -l)'
    $pgCtl = Join-Path $pgBin 'pg_ctl.exe'
    $pgLog = Join-Path $logDir 'postgres.log'
    $pgStartLog = Join-Path $logDir 'pg_ctl-start.log'
    # Use -Wait (no PowerShell 2>&1 pipe). pg_ctl writes server output to -l $pgLog.
    $pgProc = Start-Process -FilePath $pgCtl -ArgumentList @(
        '-D', $pgData,
        '-l', $pgLog,
        '-o', '-p 5434 -h 127.0.0.1',
        '-w',
        'start'
    ) -WindowStyle Hidden -PassThru -Wait
    if (Test-Path $pgStartLog) { Remove-Item $pgStartLog -Force -ErrorAction SilentlyContinue }
    $pgExit = if ($null -ne $pgProc) { $pgProc.ExitCode } else { -1 }
    Write-InstallLogLine -Context $ctx -Level 'INFO' -Message "pg_ctl start exit=$pgExit"
    if ($pgExit -ne 0 -and -not (Test-PostgresPortListening)) {
        Write-PostgresLogTail
        throw "pg_ctl start failed (exit $pgExit). See $pgLog and $installLog"
    }

    Wait-PostgresReady
    Write-InstallLogLine -Context $ctx -Level 'OK' -Message 'Postgres ready on 127.0.0.1:5434'
}

function Ensure-PrismaBundleLinks {
    param([string]$Bundle)
    $repairPrisma = Join-Path $InstallHome 'scripts\repair-prisma-bundle-links.ps1'
    if (Test-Path $repairPrisma) {
        & $repairPrisma -BundleDir $Bundle
    }
    $repairHoist = Join-Path $InstallHome 'scripts\repair-pnpm-hoist-links.ps1'
    if (Test-Path $repairHoist) {
        & $repairHoist -BundleDir $Bundle
        return
    }
    if (Test-Path $repairPrisma) { return }
    $nodeModules = Join-Path $Bundle 'node_modules'
    $pnpmDir = Join-Path $nodeModules '.pnpm'
    $enginesPkg = Get-ChildItem $pnpmDir -Directory -Filter '@prisma+engines@*' -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $enginesPkg) { return }
    $target = Join-Path $enginesPkg.FullName 'node_modules\@prisma\engines'
    $link = Join-Path $nodeModules '@prisma\engines'
    if ((Test-Path $link) -or -not (Test-Path $target)) { return }
    New-Item -ItemType Directory -Path (Split-Path $link) -Force | Out-Null
    New-Item -ItemType Junction -Path $link -Target $target -Force | Out-Null
}

function Complete-InstallAndStartNode {
    if (-not (Test-Path $completeMarker)) {
        New-Item -ItemType File -Path $completeMarker -Force | Out-Null
    }
    Write-InstallLog -Path $installLog -Output '[install-db] database setup completed'
    try {
        $healthOk = $false
        try {
            $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:5180/health' -TimeoutSec 3 -UseBasicParsing
            $healthOk = $resp.StatusCode -eq 200 -and $resp.Content -match '"status"\s*:\s*"ok"'
        }
        catch { $healthOk = $false }
        if ($healthOk) {
            Write-InstallLog -Path $installLog -Output '[install-db] start-node skipped (/health already ok)'
        }
        else {
            Clear-PortForInstall -Port 5180
            Write-Host '[install-db] Starting application server...'
            & (Join-Path $InstallHome 'scripts\start-node.ps1') -InstallHome $InstallHome
            Write-InstallLog -Path $installLog -Output '[install-db] start-node OK'
        }
    }
    catch {
        Write-InstallLogLine -Context $ctx -Level 'FAIL' -Message "start-node failed: $_"
        Write-Warning "Database is ready but Node did not start: $_"
        Write-Warning 'See logs\node-stdout.log and install.log. Run start.bat after fixing.'
        throw "Application server failed to start: $_"
    }
    Write-InstallLog -Path $installLog -Output '[install-db] install completed'
    Write-InstallLogSessionEnd -Context $ctx -Success $true
    Write-Host '[install-db] Done.'
}

function Invoke-InstallNode {
    param(
        [string[]]$NodeArgs,
        [string]$LogPath,
        [string]$Label
    )
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    Write-Host "[install-db] $Label..."
    Write-InstallLog -Path $LogPath -Output "[install-db] $Label"
    $output = & $node @NodeArgs 2>&1
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    Write-InstallLog -Path $LogPath -Output $output
    $text = (@($output) | Out-String).Trim()
    if ($text) { Write-Host $text }
    if ($exitCode -ne 0) {
        throw "$Label failed (exit $exitCode). See $LogPath"
    }
}

function Wait-PostgresReady {
    param([int]$TimeoutSeconds = 180)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PostgresIsReady -InstallHome $InstallHome) { return }
        Start-Sleep -Seconds 1
    }
    throw "Postgres did not become ready on 127.0.0.1:5434 within ${TimeoutSeconds}s. See $installLog and logs\postgres.log"
}

function Test-TeacherTable {
    return Test-LanExamTeacherTable -InstallHome $InstallHome
}

if (-not (Test-Path $envFile)) { throw ".env not found at $envFile" }

#region agent log
Write-DebugNdjson -HypothesisId 'H6' -Location 'install-db.ps1:entry' -Message 'install-db start' -Data @{
    invokeSource = $InvokeSource
    user         = $env:USERNAME
    isAdmin      = $ctx.IsAdmin
    installHome  = $InstallHome
}
#endregion

try {
    Enter-InstallDbLock
    Write-InstallLogSessionStart -Context $ctx
    Write-InstallLogLine -Context $ctx -Level 'STEP' -Message 'install started'

    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }

    if (-not $env:DATABASE_URL) {
        $env:DATABASE_URL = 'postgresql://lan_exam:lan_exam@127.0.0.1:5434/lan_exam'
    }
    $env:ADMIN_AUTH_MODE = 'disabled'

    Clear-InstallPorts

    if (-not (Test-Path (Join-Path $pgData 'PG_VERSION'))) {
        Write-Host '[install-db] initdb...'
        Write-InstallLog -Path $installLog -Output '[install-db] initdb'
        $initdbLog = Join-Path $logDir 'initdb.log'
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        # Avoid interactive password prompts during installer.
        # We only listen on 127.0.0.1:5434, so trust auth is acceptable for offline single-machine setup.
        $initdbOutput = & (Join-Path $pgBin 'initdb.exe') -D $pgData -U postgres -E UTF8 --locale=C --auth-local=trust --auth-host=trust 2>&1
        $initdbExit = $LASTEXITCODE
        $ErrorActionPreference = $prevEap
        Write-InstallLog -Path $initdbLog -Output $initdbOutput
        if ($initdbExit -ne 0) {
            throw "initdb failed (exit $initdbExit). See $initdbLog"
        }
    }

    Start-PostgresIfNeeded

    $env:PGCONNECT_TIMEOUT = '10'
    $psql = Join-Path $pgBin 'psql.exe'
    Write-InstallLogLine -Context $ctx -Level 'STEP' -Message 'checking postgres role and database lan_exam'
    $hasUser = (& $psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -w -X -tAc `
        "SELECT 1 FROM pg_roles WHERE rolname='lan_exam'" 2>$null | Out-String).Trim()
    #region agent log
    Write-DebugNdjson -HypothesisId 'H1' -Location 'install-db.ps1:after-hasUser' -Message 'role check' -Data @{ hasUser = $hasUser }
    #endregion
    if ($hasUser -ne '1') {
        Write-Host '[install-db] creating role lan_exam...'
        $createUserOutput = & $psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -w -X -c `
            "CREATE USER lan_exam WITH PASSWORD 'lan_exam';" 2>&1
        Write-InstallLog -Path $installLog -Output $createUserOutput
        if ($LASTEXITCODE -ne 0) {
            throw "CREATE USER lan_exam failed (exit $LASTEXITCODE). See $installLog"
        }
    }

    $hasDb = (& $psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -w -X -tAc `
        "SELECT 1 FROM pg_database WHERE datname='lan_exam'" 2>$null | Out-String).Trim()
    if ($hasDb -ne '1') {
        Write-Host '[install-db] creating database lan_exam...'
        $createDbOutput = & $psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -w -X -c `
            "CREATE DATABASE lan_exam OWNER lan_exam;" 2>&1
        Write-InstallLog -Path $installLog -Output $createDbOutput
        if ($LASTEXITCODE -ne 0) {
            throw "CREATE DATABASE lan_exam failed (exit $LASTEXITCODE). See $installLog"
        }
    }

    $bundle = Join-Path $app 'server-bundle'
    $pnpmNodeModules = Join-Path $bundle 'node_modules\.pnpm\node_modules'
    $env:NODE_PATH = @(
        (Join-Path $bundle 'node_modules'),
        $(if (Test-Path $pnpmNodeModules) { $pnpmNodeModules })
    ) -join [IO.Path]::PathSeparator

    if (Test-TeacherTable) {
        Write-Host '[install-db] Database already migrated — skipping prisma migrate deploy'
        Write-InstallLog -Path $installLog -Output '[install-db] skip migrate (Teacher table exists)'
        Complete-InstallAndStartNode
        #region agent log
        Write-DebugNdjson -HypothesisId 'H1' -Location 'install-db.ps1:success' -Message 'install-db completed (existing db)' -Data @{
            teacherTable = $true
        }
        #endregion
        return
    }

    Write-InstallLogLine -Context $ctx -Level 'STEP' -Message 'repairing prisma/pnpm bundle links (may take 1-2 min on first scan)'
    Ensure-PrismaBundleLinks -Bundle $bundle
    Write-InstallLogLine -Context $ctx -Level 'OK' -Message 'bundle links ready'

    $prismaCli = Resolve-PrismaCliPath -BundleDir $bundle
    if (-not $prismaCli) {
        throw "Prisma CLI not readable under $bundle (broken junction after copy?). Re-run install.bat as Administrator or reinstall Setup."
    }
    Write-InstallLogLine -Context $ctx -Level 'INFO' -Message "prisma CLI resolved path=$prismaCli"
    if (-not (Test-PrismaCliRunnable -NodeExe $node -PrismaCliPath $prismaCli -BundleDir $bundle)) {
        throw "Prisma CLI not runnable at $prismaCli — run scripts\repair-prisma-bundle-links.ps1 or reinstall from LAN-Exam-Setup."
    }
    Write-InstallLogLine -Context $ctx -Level 'OK' -Message 'prisma CLI runnable (version check)'

    $schema = Join-Path $app 'prisma\schema.prisma'
    Push-Location $bundle
    try {
        Invoke-InstallNode -NodeArgs @(
            $prismaCli, 'migrate', 'deploy', '--schema', $schema
        ) -LogPath $installLog -Label 'prisma migrate deploy'
    }
    finally {
        Pop-Location
    }

    if (-not (Test-TeacherTable)) {
        throw 'Database migrations did not create table Teacher. See logs\install.log'
    }

    $seedLog = Join-Path $logDir 'seed.log'
    $seedScript = Join-Path $app 'prisma\seed.cjs'
    if (-not (Test-Path $seedScript)) {
        throw "Missing $seedScript — reinstall from a full LAN-Exam-Setup package (v1.6.3+)."
    }
    Push-Location $app
    try {
        Invoke-InstallNode -NodeArgs @($seedScript) -LogPath $seedLog -Label 'prisma db seed'
    }
    finally {
        Pop-Location
    }

    Complete-InstallAndStartNode
    #region agent log
    Write-DebugNdjson -HypothesisId 'H1' -Location 'install-db.ps1:success' -Message 'install-db completed' -Data @{
        teacherTable = (Test-TeacherTable)
    }
    #endregion
}
catch {
    $hasTeacher = $false
    try { $hasTeacher = Test-TeacherTable } catch { }
    if (-not $hasTeacher) {
        if (Test-Path $completeMarker) { Remove-Item $completeMarker -Force }
    }
    Write-InstallLogException -Context $ctx -ErrorRecord $_
    Write-InstallLogSessionEnd -Context $ctx -Success $false
    #region agent log
    Write-DebugNdjson -HypothesisId 'H1' -Location 'install-db.ps1:catch' -Message 'install-db fatal' -Data @{
        error = "$_"
    }
    #endregion
    throw
}
finally {
    Exit-InstallDbLock
}
