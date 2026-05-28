# Builds app artifacts into dist/lan-exam-win/app (requires pnpm at repo root).
param(
    [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) {
    $OutDir = Join-Path $root 'dist\lan-exam-win'
} elseif (-not [System.IO.Path]::IsPathRooted($OutDir)) {
    $OutDir = Join-Path $root $OutDir
}
$OutDir = [System.IO.Path]::GetFullPath($OutDir)

$appDir = [System.IO.Path]::GetFullPath((Join-Path $OutDir 'app'))
$bundleDir = [System.IO.Path]::GetFullPath((Join-Path $appDir 'server-bundle'))
$templates = Join-Path $PSScriptRoot 'templates'

function Remove-DirForce {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
            return
        }
        catch {
            if ($attempt -eq 3) { break }
            Start-Sleep -Seconds 2
        }
    }
    cmd /c "rmdir /s /q `"$Path`"" | Out-Null
    if (Test-Path -LiteralPath $Path) {
        throw "Could not remove locked directory: $Path (close Node/IDE using server-bundle, then retry)"
    }
}

$releaseVersion = & (Join-Path $PSScriptRoot 'get-release-version.ps1') -Root $root
Write-Host "==> build-release: root=$root out=$OutDir version=$releaseVersion"

foreach ($stale in @(
        (Join-Path $root 'apps\server\dist\lan-exam-win'),
        (Join-Path $root 'apps\server\.build'),
        (Join-Path $root '.build\server-bundle'),
        $bundleDir
    )) {
    Remove-DirForce -Path $stale
}

Push-Location $root
$env:VITE_ADMIN_AUTH_MODE = 'disabled'
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }
Pop-Location

if (Test-Path $appDir) { Remove-DirForce -Path $appDir }
New-Item -ItemType Directory -Path (Join-Path $appDir 'web\dist') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $appDir 'prisma') -Force | Out-Null

Copy-Item -Recurse (Join-Path $root 'apps\web\dist\*') (Join-Path $appDir 'web\dist')
Copy-Item -Recurse (Join-Path $root 'prisma\*') (Join-Path $appDir 'prisma')
Copy-Item (Join-Path $root 'templates') (Join-Path $OutDir 'templates') -Recurse -ErrorAction SilentlyContinue
Copy-Item -Recurse (Join-Path $templates '*') (Join-Path $OutDir 'scripts') -Force

Write-Host "==> pnpm deploy @lan-exam/server -> $bundleDir"
New-Item -ItemType Directory -Path (Split-Path $bundleDir) -Force | Out-Null
Push-Location $root
pnpm --filter @lan-exam/server deploy --prod --ignore-scripts $bundleDir
if ($LASTEXITCODE -ne 0) { throw 'pnpm deploy failed' }
Pop-Location
& (Join-Path $PSScriptRoot 'repair-prisma-bundle-links.ps1') -BundleDir $bundleDir
& (Join-Path $PSScriptRoot 'repair-pnpm-hoist-links.ps1') -BundleDir $bundleDir
$bundleData = Join-Path $bundleDir 'data'
if (Test-Path $bundleData) {
    Remove-Item -LiteralPath $bundleData -Recurse -Force
    Write-Host "==> removed dev DATA_DIR from server-bundle (not for shipping)"
}
foreach ($stale in @(
        (Join-Path $root 'apps\server\.build'),
        (Join-Path $root 'apps\server\dist\lan-exam-win')
    )) {
    if (Test-Path $stale) { Remove-Item -Recurse -Force $stale }
}

$bundleDist = Join-Path $bundleDir 'dist'
New-Item -ItemType Directory -Path $bundleDist -Force | Out-Null
$serverDist = Join-Path $root 'apps\server\dist'
Get-ChildItem $serverDist | Where-Object { $_.Name -ne 'lan-exam-win' } | ForEach-Object {
    Copy-Item -Recurse $_.FullName (Join-Path $bundleDist $_.Name) -Force
}

$schema = Join-Path $appDir 'prisma\schema.prisma'
$schemaText = [System.IO.File]::ReadAllText($schema)
if ($schemaText -notmatch 'output\s*=') {
    $schemaText = $schemaText -replace '(generator client \{\r?\n\s+provider = "prisma-client-js")', "`$1`r`n  output   = `"../server-bundle/node_modules/.prisma/client`""
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($schema, $schemaText, $utf8NoBom)
}

Write-Host "==> prisma generate ($schema) via repo pnpm"
$bundlePrismaCli = Join-Path $bundleDir 'node_modules\prisma\build\index.js'
if (-not (Test-Path $bundlePrismaCli)) {
    throw "Prisma CLI missing in server-bundle after pnpm deploy — ensure apps/server lists prisma in dependencies and run pnpm install"
}

$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
Push-Location $root
pnpm exec prisma generate --schema $schema 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'prisma generate failed' }
Pop-Location
$ErrorActionPreference = $prevEap

$prismaClientEngine = Join-Path $bundleDir 'node_modules\.prisma\client\query_engine-windows.dll.node'
if (-not (Test-Path $prismaClientEngine)) {
    throw "Prisma client engine missing after generate: $prismaClientEngine"
}

Write-Host '==> prefetch Prisma engine binaries (build machine needs network once)'
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
Push-Location $bundleDir
$env:PRISMA_HIDE_UPDATE_MESSAGE = 'true'
& node (Join-Path $bundleDir 'node_modules\prisma\build\index.js') version 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'prisma engine prefetch failed (check network on build machine)' }
Pop-Location
$ErrorActionPreference = $prevEap
$found = Get-ChildItem (Join-Path $bundleDir 'node_modules\.pnpm') -Recurse -Filter 'schema-engine-windows.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $found) { throw 'schema-engine-windows.exe missing after prefetch' }

Write-Host '==> compile prisma/seed.cjs (offline install, no tsx on target machine)'
$seedCjs = Join-Path $appDir 'prisma\seed.cjs'
$seedTs = Join-Path $root 'prisma\seed.ts'
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
Push-Location $root
pnpm dlx esbuild@0.25.12 $seedTs --bundle --platform=node --format=cjs --outfile=$seedCjs --packages=external 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'esbuild seed.cjs failed' }
Pop-Location
$ErrorActionPreference = $prevEap
if (-not (Test-Path $seedCjs)) {
    throw "Missing compiled seed script: $seedCjs"
}

# Root batch files + install script
foreach ($f in @('start.bat', 'stop.bat', 'open-admin.bat', 'install.bat')) {
    Copy-Item (Join-Path $templates $f) (Join-Path $OutDir $f) -Force
}
New-Item -ItemType Directory -Path (Join-Path $OutDir 'scripts') -Force | Out-Null
Copy-Item (Join-Path $templates 'install-db.ps1') (Join-Path $OutDir 'scripts\install-db.ps1') -Force
Copy-Item (Join-Path $templates 'stop-postgres.ps1') (Join-Path $OutDir 'scripts\stop-postgres.ps1') -Force
Copy-Item (Join-Path $templates 'write-env.ps1') (Join-Path $OutDir 'scripts\write-env.ps1') -Force
Copy-Item (Join-Path $templates 'start-node.ps1') (Join-Path $OutDir 'scripts\start-node.ps1') -Force
Copy-Item (Join-Path $templates 'ensure-db-ready.ps1') (Join-Path $OutDir 'scripts\ensure-db-ready.ps1') -Force
Copy-Item (Join-Path $templates 'verify-install.ps1') (Join-Path $OutDir 'scripts\verify-install.ps1') -Force
Copy-Item (Join-Path $PSScriptRoot 'repair-prisma-bundle-links.ps1') (Join-Path $OutDir 'scripts\repair-prisma-bundle-links.ps1') -Force
Copy-Item (Join-Path $PSScriptRoot 'repair-pnpm-hoist-links.ps1') (Join-Path $OutDir 'scripts\repair-pnpm-hoist-links.ps1') -Force

$envExample = @"
ADMIN_AUTH_MODE=disabled
LOCAL_ADMIN_USERNAME=local_exam_admin
ADMIN_API_LOOPBACK_ONLY=true
LISTEN_HOST=0.0.0.0
WEB_PORT=5180
DATABASE_URL=postgresql://lan_exam:lan_exam@127.0.0.1:5434/lan_exam
SESSION_SECRET=CHANGE_ME_ON_INSTALL
NODE_ENV=production
SERVE_WEB=true
WEB_DIST_PATH=
"@
Set-Content -Path (Join-Path $OutDir '.env.example') -Value $envExample -Encoding UTF8

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText(
    (Join-Path $OutDir 'VERSION'),
    "$releaseVersion`n",
    $utf8NoBom
)

Write-Host "==> build-release complete: $OutDir (version $releaseVersion)"
