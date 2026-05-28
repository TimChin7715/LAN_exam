param(
    [Parameter(Mandatory = $true)]
    [string]$InstallHome,
    [string]$InvokeSource = 'unknown'
)

$ErrorActionPreference = 'Stop'
$InstallHome = $InstallHome.TrimEnd('\')
$env:LAN_EXAM_HOME = $InstallHome

$node = Join-Path $InstallHome 'runtime\node\node.exe'
$pgBin = Join-Path $InstallHome 'runtime\postgres\bin'
$pgData = Join-Path $InstallHome 'data\pg'
$logDir = Join-Path $InstallHome 'logs'
$app = Join-Path $InstallHome 'app'
$envFile = Join-Path $InstallHome '.env'
$installLog = Join-Path $logDir 'install.log'
$debugLog = Join-Path $logDir 'debug-57b789.log'
$completeMarker = Join-Path $InstallHome 'data\.install-db-complete'

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
    if (-not $text) { return }
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::AppendAllText($Path, $text + [Environment]::NewLine, $utf8NoBom)
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
    $stopPg = Join-Path $InstallHome 'scripts\stop-postgres.ps1'
    if (Test-Path $stopPg) {
        Write-Host 'install-db: Stopping existing LAN Exam Postgres (if any)...'
        $stopPgOut = & $stopPg -InstallHome $InstallHome 2>&1
        Write-InstallLog -Path $installLog -Output $stopPgOut
    }
    Clear-PortForInstall -Port 5434
}

function Start-PostgresIfNeeded {
    $listening = netstat -ano | Select-String '127.0.0.1:5434' | Select-String 'LISTENING'
    if ($listening) { return }

    if (-not (Test-Path (Join-Path $pgData 'PG_VERSION'))) {
        throw 'Postgres data not initialized. initdb should have run first.'
    }

    Write-Host '[install-db] Starting Postgres on 127.0.0.1:5434...'
    Write-InstallLog -Path $installLog -Output '[install-db] pg_ctl start'
    $pgCtl = Join-Path $pgBin 'pg_ctl.exe'
    $pgLog = Join-Path $logDir 'postgres.log'
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $pgStartOut = & $pgCtl -D $pgData -l $pgLog -o '-p 5434 -h 127.0.0.1' start 2>&1
    $pgExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    Write-InstallLog -Path $installLog -Output $pgStartOut
    $pgText = (@($pgStartOut) | Out-String)
    if ($pgExit -ne 0 -and $pgText -notmatch 'already running|可能正在运行|already started|another server') {
        throw "pg_ctl start failed (exit $pgExit). See $pgLog and $installLog"
    }
    Wait-PostgresReady
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
    Clear-PortForInstall -Port 5180
    Write-Host '[install-db] Starting application server...'
    try {
        & (Join-Path $InstallHome 'scripts\start-node.ps1') -InstallHome $InstallHome
        Write-InstallLog -Path $installLog -Output '[install-db] start-node OK'
    }
    catch {
        Write-InstallLog -Path $installLog -Output "[install-db] WARNING: start-node failed: $_"
        Write-Warning "Database is ready but Node did not start: $_"
        Write-Warning 'Run start.bat or LAN-Exam-Tray.exe after install.'
    }
    Write-InstallLog -Path $installLog -Output '[install-db] install completed'
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
    param([int]$TimeoutSeconds = 90)
    $pgIsready = Join-Path $pgBin 'pg_isready.exe'
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Path $pgIsready) {
            & $pgIsready -h 127.0.0.1 -p 5434 -U postgres -q 2>$null
            if ($LASTEXITCODE -eq 0) { return }
        }
        else {
            $listening = netstat -ano | Select-String '127.0.0.1:5434' | Select-String 'LISTENING'
            if ($listening) { return }
        }
        Start-Sleep -Seconds 1
    }
    throw "Postgres did not become ready on 127.0.0.1:5434 within ${TimeoutSeconds}s. See $installLog and logs\postgres.log"
}

function Test-TeacherTable {
    $psql = Join-Path $pgBin 'psql.exe'
    $result = (& $psql -h 127.0.0.1 -p 5434 -U lan_exam -d lan_exam -w -X -tAc `
        "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Teacher'" `
        2>$null | Out-String).Trim()
    return $result -eq '1'
}

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
if (-not (Test-Path $envFile)) { throw ".env not found at $envFile" }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
#region agent log
Write-DebugNdjson -HypothesisId 'H6' -Location 'install-db.ps1:entry' -Message 'install-db start' -Data @{
    invokeSource = $InvokeSource
    user         = $env:USERNAME
    isAdmin      = $isAdmin
    installHome  = $InstallHome
}
#endregion

try {
    $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Write-InstallLog -Path $installLog -Output "=== [$stamp] install-db invoke=$InvokeSource user=$env:USERNAME admin=$isAdmin ==="
    Write-InstallLog -Path $installLog -Output '[install-db] install started'

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
    $prismaCli = Join-Path $bundle 'node_modules\prisma\build\index.js'
    if (-not (Test-Path $prismaCli)) {
        throw "Prisma CLI not found at $prismaCli — rebuild the release package."
    }
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

    Ensure-PrismaBundleLinks -Bundle $bundle

    $schema = Join-Path $app 'prisma\schema.prisma'
    Push-Location $app
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
    Write-InstallLog -Path $installLog -Output "[install-db] FATAL: $_"
    #region agent log
    Write-DebugNdjson -HypothesisId 'H1' -Location 'install-db.ps1:catch' -Message 'install-db fatal' -Data @{
        error = "$_"
    }
    #endregion
    throw
}
