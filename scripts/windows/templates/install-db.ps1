param(
    [Parameter(Mandatory = $true)]
    [string]$InstallHome
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

function Write-InstallLog {
    param([string]$Path, [object]$Output)
    if ($null -eq $Output) { return }
    $text = (@($Output) | ForEach-Object { "$_" }) -join [Environment]::NewLine
    if (-not $text) { return }
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::AppendAllText($Path, $text + [Environment]::NewLine, $utf8NoBom)
}

function Get-PortListenerPath {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $conn) { return $null }
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    return $proc.Path
}

function Assert-LanExamOwnsPort5434 {
    $listener = Get-PortListenerPath -Port 5434
    if (-not $listener) { return }
    $expectedDir = (Join-Path $pgBin 'postgres.exe').ToLowerInvariant()
    if ($listener.ToLowerInvariant() -eq $expectedDir) { return }
    throw @"
端口 5434 已被其它程序占用：$listener
本系统需要使用自带的 PostgreSQL（$expectedDir）。
请先关闭 Docker（docker compose down）或其它占用 5434 的服务，然后重新运行 install.bat。
"@
}

function Start-PostgresIfNeeded {
    Assert-LanExamOwnsPort5434

    $listening = netstat -ano | Select-String '127.0.0.1:5434' | Select-String 'LISTENING'
    if ($listening) { return }

    if (-not (Test-Path (Join-Path $pgData 'PG_VERSION'))) {
        throw 'Postgres data not initialized. initdb should have run first.'
    }

    Write-Host '[install-db] Starting Postgres on 127.0.0.1:5434...'
    Write-InstallLog -Path $installLog -Output '[install-db] pg_ctl start'
    $pgCtl = Join-Path $pgBin 'pg_ctl.exe'
    $pgLog = Join-Path $logDir 'postgres.log'
    & $pgCtl -D $pgData -l $pgLog -o '-p 5434 -h 127.0.0.1' start 2>&1 | ForEach-Object { Write-InstallLog -Path $installLog -Output $_ }
    if ($LASTEXITCODE -ne 0) {
        throw "pg_ctl start failed (exit $LASTEXITCODE). See $pgLog and $installLog"
    }
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
    $result = (& $psql -h 127.0.0.1 -p 5434 -U lan_exam -d lan_exam -tAc `
        "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Teacher'" `
        2>$null | Out-String).Trim()
    return $result -eq '1'
}

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
if (-not (Test-Path $envFile)) { throw ".env not found at $envFile" }

try {
    if (Test-Path $installLog) { Remove-Item $installLog -Force }
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

    Assert-LanExamOwnsPort5434

    if (-not (Test-Path (Join-Path $pgData 'PG_VERSION'))) {
        Write-Host '[install-db] initdb...'
        Write-InstallLog -Path $installLog -Output '[install-db] initdb'
        $initdbLog = Join-Path $logDir 'initdb.log'
        $initdbOutput = & (Join-Path $pgBin 'initdb.exe') -D $pgData -U postgres -E UTF8 --locale=C 2>&1
        Write-InstallLog -Path $initdbLog -Output $initdbOutput
        if ($LASTEXITCODE -ne 0) {
            throw "initdb failed (exit $LASTEXITCODE). See $initdbLog"
        }
    }

    Start-PostgresIfNeeded
    Wait-PostgresReady
    Assert-LanExamOwnsPort5434

    $psql = Join-Path $pgBin 'psql.exe'
    $hasUser = (& $psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -tAc `
        "SELECT 1 FROM pg_roles WHERE rolname='lan_exam'" 2>$null | Out-String).Trim()
    if ($hasUser -ne '1') {
        Write-Host '[install-db] creating role lan_exam...'
        $createUserOutput = & $psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -c `
            "CREATE USER lan_exam WITH PASSWORD 'lan_exam';" 2>&1
        Write-InstallLog -Path $installLog -Output $createUserOutput
        if ($LASTEXITCODE -ne 0) {
            throw "CREATE USER lan_exam failed (exit $LASTEXITCODE). See $installLog"
        }
    }

    $hasDb = (& $psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -tAc `
        "SELECT 1 FROM pg_database WHERE datname='lan_exam'" 2>$null | Out-String).Trim()
    if ($hasDb -ne '1') {
        Write-Host '[install-db] creating database lan_exam...'
        $createDbOutput = & $psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -c `
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
    $env:NODE_PATH = Join-Path $bundle 'node_modules'

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

    Write-InstallLog -Path $installLog -Output '[install-db] database setup completed'

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
catch {
    Write-InstallLog -Path $installLog -Output "[install-db] FATAL: $_"
    throw
}
