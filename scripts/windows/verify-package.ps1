# Validates dist/lan-exam-win green package (run after build-release.ps1).
param(
    [string]$OutDir = '',
    [switch]$TestWithDockerDb
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) {
    $OutDir = Join-Path $root 'dist\lan-exam-win'
}
$OutDir = [System.IO.Path]::GetFullPath($OutDir)
$app = Join-Path $OutDir 'app'
$bundle = Join-Path $app 'server-bundle'
$usageGuide = Get-ChildItem -LiteralPath $OutDir -File -Filter '*.txt' |
    Where-Object { $_.Name -notlike 'README*' } |
    Select-Object -First 1
if (-not $usageGuide) {
    throw "Missing exam room guide .txt in $OutDir"
}

$required = @(
    (Join-Path $OutDir 'VERSION'),
    (Join-Path $OutDir 'start.bat'),
    (Join-Path $OutDir 'install.bat'),
    (Join-Path $OutDir 'setup.bat'),
    (Join-Path $OutDir 'scripts\setup.ps1'),
    $usageGuide.FullName,
    (Join-Path $OutDir 'scripts\install-db.ps1'),
    (Join-Path $app 'web\dist\index.html'),
    (Join-Path $app 'prisma\schema.prisma'),
    (Join-Path $bundle 'dist\index.js'),
    (Join-Path $bundle 'node_modules\prisma\build\index.js'),
    (Join-Path $bundle 'node_modules\.prisma\client\query_engine-windows.dll.node'),
    (Join-Path $app 'prisma\seed.cjs'),
    (Join-Path $OutDir 'runtime\postgres\share\timezone'),
    (Join-Path $OutDir 'runtime\postgres\bin\initdb.exe'),
    (Join-Path $OutDir 'runtime\postgres\bin\pg_ctl.exe'),
    (Join-Path $OutDir 'runtime\postgres\bin\psql.exe'),
    (Join-Path $OutDir 'runtime\node\node.exe')
)
foreach ($path in $required) {
    if (-not (Test-Path $path)) {
        throw "Missing required package file: $path"
    }
}

$pgRoot = Join-Path $OutDir 'runtime\postgres'
$forbiddenUnderPostgres = @('doc', 'include', 'StackBuilder')
foreach ($name in $forbiddenUnderPostgres) {
    $path = Join-Path $pgRoot $name
    if (Test-Path -LiteralPath $path) {
        throw "Forbidden postgres runtime path still present: $path"
    }
}
foreach ($pgAdminDir in Get-ChildItem -LiteralPath $pgRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'pgAdmin*' }) {
    throw "Forbidden postgres runtime path still present: $($pgAdminDir.FullName)"
}
$localePath = Join-Path $pgRoot 'share\locale'
if (Test-Path -LiteralPath $localePath) {
    throw "Forbidden postgres runtime path still present: $localePath"
}

$bundledNodeModules = Join-Path $OutDir 'runtime\node\node_modules'
if (Test-Path -LiteralPath $bundledNodeModules) {
    throw "Bundled node runtime must not ship node_modules: $bundledNodeModules"
}

$bundledNodeExe = Join-Path $OutDir 'runtime\node\node.exe'
$prevEapNode = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$nodeVersion = & $bundledNodeExe -e "console.log(process.version)" 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Bundled node.exe smoke test failed (exit $LASTEXITCODE): $nodeVersion"
}
$ErrorActionPreference = $prevEapNode
Write-Host "[verify] bundled node.exe OK ($($nodeVersion.Trim()))"

$repoTemplates = Join-Path $root 'templates'
$packTemplates = Join-Path $OutDir 'templates'
if (-not (Test-Path $packTemplates)) {
    throw "Missing templates directory: $packTemplates"
}
Get-ChildItem $repoTemplates -File | ForEach-Object {
    $dest = Join-Path $packTemplates $_.Name
    if (-not (Test-Path $dest)) {
        throw "Missing required package file: $dest (expected copy of $($_.Name))"
    }
}
$requiredXlsx = @(Get-ChildItem $repoTemplates -Filter '*.xlsx')
if ($requiredXlsx.Count -lt 3) {
    throw "Repo templates must include at least 3 .xlsx files, found $($requiredXlsx.Count)"
}
Write-Host '[verify] required files OK'

$prismaCli = Join-Path $bundle 'node_modules\prisma\build\index.js'
$enginesInPnpm = Get-ChildItem (Join-Path $bundle 'node_modules\.pnpm') -Directory -Filter '@prisma+engines@*' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $enginesInPnpm) {
    throw 'Missing @prisma/engines in server-bundle (prisma CLI needs it for install.bat)'
}
$enginesRoot = Join-Path $enginesInPnpm.FullName 'node_modules\@prisma\engines'
$schemaEnginePath = Join-Path $enginesRoot 'schema-engine-windows.exe'
if (-not (Test-Path $schemaEnginePath)) {
    $schemaEngine = Get-ChildItem (Join-Path $bundle 'node_modules\.pnpm') -Recurse -Filter 'schema-engine-windows.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $schemaEngine) {
        throw 'Missing schema-engine-windows.exe (run package on a machine with network so build-release can prefetch engines)'
    }
}
Write-Host '[verify] prisma CLI + engines on disk OK (offline check, no network)'

$bundleNodeModules = Join-Path $bundle 'node_modules'
$pnpmNodeModules = Join-Path $bundleNodeModules '.pnpm\node_modules'
$nodePathParts = @($bundleNodeModules)
if (Test-Path $pnpmNodeModules) { $nodePathParts += $pnpmNodeModules }
$env:NODE_PATH = $nodePathParts -join [IO.Path]::PathSeparator
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& node -e "import('@prisma/client').then(()=>console.log('[verify] @prisma/client OK')).catch(e=>{console.error(e);process.exit(1)})" 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) { throw '@prisma/client import failed' }
& node -e "try { require('archiver'); console.log('[verify] archiver OK') } catch(e) { console.error(e); process.exit(1) }" 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'archiver import failed (check NODE_PATH / pnpm bundle)' }
$ErrorActionPreference = $prevEap

if ($TestWithDockerDb) {
    $dbUrl = 'postgresql://lan_exam:lan_exam_dev@127.0.0.1:5434/lan_exam'
    $env:DATABASE_URL = $dbUrl
    $env:ADMIN_AUTH_MODE = 'disabled'
    Write-Host "[verify] prisma migrate deploy against $dbUrl"
    & node $prismaCli migrate deploy --schema (Join-Path $app 'prisma\schema.prisma')
    if ($LASTEXITCODE -ne 0) { throw 'prisma migrate deploy failed (is docker db up on 5434?)' }
    Write-Host '[verify] migrate deploy OK'

    $env:NODE_ENV = 'production'
    $env:SERVE_WEB = 'true'
    $env:SESSION_SECRET = 'verify-package-secret-min-16-chars'
    $env:WEB_DIST_PATH = Join-Path $app 'web\dist'
    $env:NODE_PATH = Join-Path $bundle 'node_modules'
    $env:LISTEN_HOST = '127.0.0.1'
    $env:WEB_PORT = '5180'

    # Stop anything already listening (e.g. docker compose app on 5180)
    Get-NetTCPConnection -LocalPort 5180 -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1

    $proc = Start-Process -FilePath 'node' `
        -ArgumentList (Join-Path $bundle 'dist\index.js') `
        -WorkingDirectory $app `
        -PassThru -WindowStyle Hidden
    try {
        $ok = $false
        for ($i = 0; $i -lt 20; $i++) {
            try {
                $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:5180/health' -TimeoutSec 2 -UseBasicParsing
                if ($resp.Content -match '"status"\s*:\s*"ok"') {
                    $ok = $true
                    break
                }
            }
            catch {
                if (-not $proc.HasExited) {
                    Start-Sleep -Seconds 1
                    continue
                }
                throw "Packaged server exited before /health responded (exit $($proc.ExitCode))"
            }
            Start-Sleep -Seconds 1
        }
        if (-not $ok) {
            throw 'Timed out waiting for http://127.0.0.1:5180/health'
        }
        Write-Host '[verify] /health OK'
    }
    finally {
        if ($proc -and -not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
        Get-NetTCPConnection -LocalPort 5180 -State Listen -ErrorAction SilentlyContinue |
            ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    }
}

Write-Host '[verify] package validation passed'
