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

if (-not (Test-Path (Join-Path $pgData 'PG_VERSION'))) {
    Write-Host '[install-db] initdb...'
    & (Join-Path $pgBin 'initdb.exe') -D $pgData -U postgres -E UTF8 --locale=C `
        *> (Join-Path $logDir 'initdb.log')

    & (Join-Path $InstallHome 'start.bat')
    Start-Sleep -Seconds 4

    $psql = Join-Path $pgBin 'psql.exe'
    & $psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -c "CREATE USER lan_exam WITH PASSWORD 'lan_exam';" `
        2>&1 | Out-File (Join-Path $logDir 'install.log') -Append
    & $psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -c "CREATE DATABASE lan_exam OWNER lan_exam;" `
        2>&1 | Out-File (Join-Path $logDir 'install.log') -Append
}

& (Join-Path $InstallHome 'start.bat')
Start-Sleep -Seconds 3

$bundle = Join-Path $app 'server-bundle'
$prismaCli = Join-Path $bundle 'node_modules\prisma\build\index.js'
if (-not (Test-Path $prismaCli)) {
    throw "Prisma CLI not found at $prismaCli — rebuild the release package."
}
$env:NODE_PATH = Join-Path $bundle 'node_modules'

$schema = Join-Path $app 'prisma\schema.prisma'
Write-Host '[install-db] prisma migrate deploy...'
& $node $prismaCli migrate deploy --schema $schema 2>&1 `
    | Tee-Object -FilePath (Join-Path $logDir 'install.log') -Append

Write-Host '[install-db] prisma db seed...'
$seedScript = Join-Path $app 'prisma\seed.cjs'
if (Test-Path $seedScript) {
    & $node $seedScript 2>&1 | Tee-Object -FilePath (Join-Path $logDir 'seed.log') -Append
} else {
    $tsx = Join-Path $bundle 'node_modules\tsx\dist\cli.mjs'
    & $node $tsx (Join-Path $app 'prisma\seed.ts') 2>&1 | Tee-Object -FilePath (Join-Path $logDir 'seed.log') -Append
}

Write-Host '[install-db] Done.'
