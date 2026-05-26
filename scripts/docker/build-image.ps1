# Build LAN Exam application image (requires Docker running)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')

$version = 'latest'
if (Test-Path 'VERSION') {
  $version = (Get-Content 'VERSION' -Raw).Trim()
}

$tag = "lan-exam:$version"
Write-Host "Building $tag and lan-exam:latest ..."
docker build -t $tag -t lan-exam:latest .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Done. Run: docker compose up -d'
Write-Host '  See docs/DEPLOY-DOCKER.md for full usage.'
