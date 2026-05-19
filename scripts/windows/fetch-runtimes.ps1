# Download Node, PostgreSQL portable, and VC++ redist into dist/lan-exam-win/runtime (online build machine only).
param(
    [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) {
    $OutDir = Join-Path $root 'dist\lan-exam-win'
}

$runtime = Join-Path $OutDir 'runtime'
$nodeVer = '22.15.0'
$pgVer = '16.6-1'

New-Item -ItemType Directory -Path (Join-Path $runtime 'node') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $runtime 'postgres') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $runtime 'vcredist') -Force | Out-Null

$cache = Join-Path $root 'dist\cache'
New-Item -ItemType Directory -Path $cache -Force | Out-Null

# Node.js Windows x64 zip
$nodeZip = Join-Path $cache "node-v$nodeVer-win-x64.zip"
$nodeUrl = "https://nodejs.org/dist/v$nodeVer/node-v$nodeVer-win-x64.zip"
if (-not (Test-Path $nodeZip)) {
    Write-Host "Downloading $nodeUrl"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip
}
$nodeExtract = Join-Path $cache "node-v$nodeVer-win-x64"
if (-not (Test-Path $nodeExtract)) {
    Expand-Archive -Path $nodeZip -DestinationPath $cache -Force
}
Copy-Item -Recurse (Join-Path $nodeExtract '*') (Join-Path $runtime 'node') -Force

# PostgreSQL binaries (zip from EDB — adjust URL if mirror changes)
$pgZip = Join-Path $cache "postgresql-$pgVer-windows-x64-binaries.zip"
$pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-$pgVer-windows-x64-binaries.zip"
if (-not (Test-Path $pgZip)) {
    Write-Host "Downloading PostgreSQL $pgVer binaries..."
    Invoke-WebRequest -Uri $pgUrl -OutFile $pgZip
}
$pgExtract = Join-Path $cache 'pgsql'
if (-not (Test-Path $pgExtract)) {
    Expand-Archive -Path $pgZip -DestinationPath $cache -Force
    $inner = Get-ChildItem $cache -Directory | Where-Object { $_.Name -like 'pgsql*' } | Select-Object -First 1
    if ($inner) { Rename-Item $inner.FullName $pgExtract -ErrorAction SilentlyContinue }
}
Copy-Item -Recurse (Join-Path $pgExtract '*') (Join-Path $runtime 'postgres') -Force

# VC++ 2015-2022 x64 redistributable (allowed to bundle)
$vcExe = Join-Path $runtime 'vcredist\vc_redist.x64.exe'
if (-not (Test-Path $vcExe)) {
    $vcUrl = 'https://aka.ms/vs/17/release/vc_redist.x64.exe'
    Write-Host "Downloading VC++ redistributable..."
    Invoke-WebRequest -Uri $vcUrl -OutFile $vcExe
}

Write-Host "==> fetch-runtimes complete: $runtime"
