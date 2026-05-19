# Builds app artifacts into dist/lan-exam-win/app (requires pnpm at repo root).
param(
    [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) {
    $OutDir = Join-Path $root 'dist\lan-exam-win'
}

$appDir = Join-Path $OutDir 'app'
$templates = Join-Path $PSScriptRoot 'templates'

Write-Host "==> build-release: root=$root out=$OutDir"

Push-Location $root
$env:VITE_ADMIN_AUTH_MODE = 'disabled'
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }
Pop-Location

if (Test-Path $appDir) { Remove-Item -Recurse -Force $appDir }
New-Item -ItemType Directory -Path (Join-Path $appDir 'server\dist') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $appDir 'web\dist') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $appDir 'prisma') -Force | Out-Null

Copy-Item -Recurse (Join-Path $root 'apps\server\dist\*') (Join-Path $appDir 'server\dist')
Copy-Item -Recurse (Join-Path $root 'apps\web\dist\*') (Join-Path $appDir 'web\dist')
Copy-Item -Recurse (Join-Path $root 'prisma\*') (Join-Path $appDir 'prisma')
Copy-Item (Join-Path $root 'docs\templates') (Join-Path $appDir 'templates') -Recurse -ErrorAction SilentlyContinue

# Production deps for prisma migrate/seed at install time
Push-Location $root
pnpm deploy --filter @lan-exam/server --prod $appDir\server-bundle 2>$null
Pop-Location

# Minimal node_modules: prisma + seed runtime
$nm = Join-Path $appDir 'node_modules'
New-Item -ItemType Directory -Path $nm -Force | Out-Null
foreach ($pkg in @('prisma', '@prisma/client', 'argon2', 'tsx')) {
    $src = Join-Path $root "node_modules\$pkg"
    if (Test-Path $src) {
        Copy-Item -Recurse $src (Join-Path $nm $pkg)
    }
}

# Copy server production node_modules subset
$serverNm = Join-Path $root 'apps\server\node_modules'
if (Test-Path $serverNm) {
    Get-ChildItem $serverNm -Directory | ForEach-Object {
        $dest = Join-Path (Join-Path $appDir 'server\node_modules') $_.Name
        if (-not (Test-Path $dest)) {
            New-Item -ItemType Directory -Path (Join-Path $appDir 'server\node_modules') -Force | Out-Null
            Copy-Item -Recurse $_.FullName $dest -ErrorAction SilentlyContinue
        }
    }
}

# Root batch files + install script
foreach ($f in @('start.bat', 'stop.bat', 'open-admin.bat', 'install.bat')) {
    Copy-Item (Join-Path $templates $f) (Join-Path $OutDir $f) -Force
}
New-Item -ItemType Directory -Path (Join-Path $OutDir 'scripts') -Force | Out-Null
Copy-Item (Join-Path $templates 'install-db.ps1') (Join-Path $OutDir 'scripts\install-db.ps1') -Force
Copy-Item (Join-Path $templates 'write-env.ps1') (Join-Path $OutDir 'scripts\write-env.ps1') -Force

# Example env for packaging (installer overwrites)
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

Write-Host "==> build-release complete: $OutDir"
