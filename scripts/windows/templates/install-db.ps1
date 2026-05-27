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

function Write-InstallLog {
    param([string]$Path, [object]$Output)
    if ($null -eq $Output) { return }
    $text = (@($Output) | ForEach-Object { "$_" }) -join [Environment]::NewLine
    if (-not $text) { return }
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::AppendAllText($Path, $text + [Environment]::NewLine, $utf8NoBom)
}

function Start-PostgresIfNeeded {
    $listening = netstat -ano | Select-String '127.0.0.1:5434' | Select-String 'LISTENING'
    if ($listening) { return }

    if (-not (Test-Path (Join-Path $pgData 'PG_VERSION'))) {
        throw 'Postgres data not initialized. initdb should have run first.'
    }

    Write-Host '[install-db] Starting Postgres on 127.0.0.1:5434...'
    $pgCtl = Join-Path $pgBin 'pg_ctl.exe'
    $pgLog = Join-Path $logDir 'postgres.log'
    & $pgCtl -D $pgData -l $pgLog -o '-p 5434 -h 127.0.0.1' start | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "pg_ctl start failed (exit $LASTEXITCODE). See $pgLog"
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
    param([int]$TimeoutSeconds = 60)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $listening = netstat -ano | Select-String '127.0.0.1:5434' | Select-String 'LISTENING'
        if ($listening) { return }
        Start-Sleep -Seconds 1
    }
    throw 'Postgres did not listen on 127.0.0.1:5434 within timeout'
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

$installLog = Join-Path $logDir 'install.log'
if (Test-Path $installLog) { Remove-Item $installLog -Force }
Write-InstallLog -Path $installLog -Output '[install-db] install started'

if (-not (Test-Path (Join-Path $pgData 'PG_VERSION'))) {
    Write-Host '[install-db] initdb...'
    $initdbLog = Join-Path $logDir 'initdb.log'
    $initdbOutput = & (Join-Path $pgBin 'initdb.exe') -D $pgData -U postgres -E UTF8 --locale=C 2>&1
    Write-InstallLog -Path $initdbLog -Output $initdbOutput
    if ($LASTEXITCODE -ne 0) {
        throw "initdb failed (exit $LASTEXITCODE). See $initdbLog"
    }
}

# Only start Postgres during DB setup — Node needs lan_exam role + migrations first.
Start-PostgresIfNeeded
Wait-PostgresReady
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
} finally {
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
} finally {
    Pop-Location
}

Write-Host '[install-db] Starting application server...'
& (Join-Path $InstallHome 'start.bat')
if ($LASTEXITCODE -ne 0) {
    throw "start.bat failed (exit $LASTEXITCODE)"
}

Write-InstallLog -Path $installLog -Output '[install-db] install completed'
Write-Host '[install-db] Done.'
