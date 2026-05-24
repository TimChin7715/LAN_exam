# Builds app artifacts into dist/lan-exam-win/app (requires pnpm at repo root).
param(
    [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) {
    $OutDir = Join-Path $root 'dist\lan-exam-win'
}

$appDir = [System.IO.Path]::GetFullPath((Join-Path $OutDir 'app'))
$bundleDir = [System.IO.Path]::GetFullPath((Join-Path $appDir 'server-bundle'))
# pnpm deploy treats paths containing "dist" as relative to apps/server/dist — stage elsewhere first
$bundleStage = [System.IO.Path]::GetFullPath((Join-Path $root '.build\server-bundle'))
$templates = Join-Path $PSScriptRoot 'templates'

$releaseVersion = & (Join-Path $PSScriptRoot 'get-release-version.ps1') -Root $root
Write-Host "==> build-release: root=$root out=$OutDir version=$releaseVersion"

foreach ($stale in @(
        (Join-Path $root 'apps\server\dist\lan-exam-win'),
        (Join-Path $root 'apps\server\.build'),
        $bundleStage,
        $bundleDir
    )) {
    if (Test-Path $stale) { Remove-Item -Recurse -Force $stale }
}

Push-Location $root
$env:VITE_ADMIN_AUTH_MODE = 'disabled'
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }
Pop-Location

if (Test-Path $appDir) { Remove-Item -Recurse -Force $appDir }
New-Item -ItemType Directory -Path (Join-Path $appDir 'web\dist') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $appDir 'prisma') -Force | Out-Null

Copy-Item -Recurse (Join-Path $root 'apps\web\dist\*') (Join-Path $appDir 'web\dist')
Copy-Item -Recurse (Join-Path $root 'prisma\*') (Join-Path $appDir 'prisma')
Copy-Item (Join-Path $root 'templates') (Join-Path $OutDir 'templates') -Recurse -ErrorAction SilentlyContinue

Write-Host "==> pnpm deploy @lan-exam/server -> $bundleStage"
New-Item -ItemType Directory -Path (Split-Path $bundleStage) -Force | Out-Null
Push-Location $root
pnpm --filter @lan-exam/server deploy --prod --ignore-scripts $bundleStage
if ($LASTEXITCODE -ne 0) { throw 'pnpm deploy failed' }
Pop-Location
Move-Item -Path $bundleStage -Destination $bundleDir
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

Write-Host "==> add Prisma CLI + tsx for install-time migrate/seed"
Push-Location $bundleDir
npm install --no-package-lock --save-dev prisma@^6.8.2 tsx@^4.19.4
if ($LASTEXITCODE -ne 0) { throw 'npm install prisma/tsx failed' }
Pop-Location

$schema = Join-Path $appDir 'prisma\schema.prisma'
$schemaText = [System.IO.File]::ReadAllText($schema)
if ($schemaText -notmatch 'output\s*=') {
    $schemaText = $schemaText -replace '(generator client \{\r?\n\s+provider = "prisma-client-js")', "`$1`r`n  output   = `"../server-bundle/node_modules/.prisma/client`""
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($schema, $schemaText, $utf8NoBom)
}

Write-Host "==> prisma generate ($schema)"
$prismaCli = Join-Path $bundleDir 'node_modules\prisma\build\index.js'
& node $prismaCli generate --schema $schema
if ($LASTEXITCODE -ne 0) { throw 'prisma generate failed' }

$prismaClientEngine = Join-Path $bundleDir 'node_modules\.prisma\client\query_engine-windows.dll.node'
if (-not (Test-Path $prismaClientEngine)) {
    throw "Prisma client engine missing after generate: $prismaClientEngine"
}

Write-Host '==> compile prisma/seed.cjs (offline install, no tsx on target machine)'
$seedCjs = Join-Path $appDir 'prisma\seed.cjs'
$seedTs = Join-Path $root 'prisma\seed.ts'
Push-Location $bundleDir
npm install --no-package-lock --no-save esbuild@0.25.12
if ($LASTEXITCODE -ne 0) { throw 'npm install esbuild failed' }
$esbuild = Join-Path $bundleDir 'node_modules\esbuild\bin\esbuild'
& node $esbuild $seedTs --bundle --platform=node --format=cjs --outfile=$seedCjs --packages=external
if ($LASTEXITCODE -ne 0) { throw 'esbuild seed.cjs failed' }
Pop-Location
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
