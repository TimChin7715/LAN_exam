# Pull/build and export LAN Exam runtime images to docker-images/
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')

$version = 'latest'
if (Test-Path 'VERSION') {
  $version = (Get-Content 'VERSION' -Raw).Trim()
}

$outDir = Join-Path (Get-Location) 'docker-images'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Host "Pull postgres:16 ..."
docker pull postgres:16

Write-Host "Build lan-exam:$version ..."
docker build -t "lan-exam:$version" -t lan-exam:latest .

Write-Host "Export to $outDir ..."
docker save -o (Join-Path $outDir 'postgres-16.tar') postgres:16
docker save -o (Join-Path $outDir "lan-exam-$version.tar") "lan-exam:$version" lan-exam:latest

$manifest = @"
LAN Exam Docker 离线镜像包
生成时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
版本: $version

文件:
  postgres-16.tar     -> docker.io/library/postgres:16
  lan-exam-$version.tar -> lan-exam:$version, lan-exam:latest

目标机导入:
  docker load -i postgres-16.tar
  docker load -i lan-exam-$version.tar
  cd <项目根目录>
  docker compose up -d
"@
$manifest | Set-Content -Encoding UTF8 (Join-Path $outDir 'README.txt')

Get-ChildItem $outDir -File | Format-Table Name, @{N='SizeMB';E={[math]::Round($_.Length/1MB,2)}} -AutoSize
Write-Host "Done. Copy folder: $outDir"
