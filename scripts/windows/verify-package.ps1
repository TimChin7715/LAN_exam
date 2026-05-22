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

$required = @(
    (Join-Path $OutDir 'start.bat'),
    (Join-Path $OutDir 'install.bat'),
    (Join-Path $OutDir 'scripts\install-db.ps1'),
    (Join-Path $app 'web\dist\index.html'),
    (Join-Path $app 'prisma\schema.prisma'),
    (Join-Path $bundle 'dist\index.js'),
    (Join-Path $bundle 'node_modules\prisma\build\index.js'),
    (Join-Path $bundle 'node_modules\.prisma\client\query_engine-windows.dll.node'),
    (Join-Path $OutDir 'templates\题库导入模板.xlsx'),
    (Join-Path $OutDir 'templates\名单导入模板.xlsx'),
    (Join-Path $OutDir 'templates\填空题导入模板.xlsx')
)
foreach ($path in $required) {
    if (-not (Test-Path $path)) {
        throw "Missing required package file: $path"
    }
}
Write-Host '[verify] required files OK'

$prismaCli = Join-Path $bundle 'node_modules\prisma\build\index.js'
Push-Location $bundle
& node $prismaCli -v | Out-Host
Pop-Location
if ($LASTEXITCODE -ne 0) { throw 'prisma CLI check failed' }
Write-Host '[verify] prisma CLI OK'

$env:NODE_PATH = Join-Path $bundle 'node_modules'
& node -e "import('@prisma/client').then(()=>console.log('[verify] @prisma/client OK')).catch(e=>{console.error(e);process.exit(1)})"
if ($LASTEXITCODE -ne 0) { throw '@prisma/client import failed' }

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
