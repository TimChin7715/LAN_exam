# Remove stale installers / logs / old green-package dirs under dist/ (keeps current VERSION only).
param(
    [string]$Root = '',
    [string]$Version = ''
)

$ErrorActionPreference = 'Stop'
if (-not $Root) {
    $Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
}
if (-not $Version) {
    $Version = & (Join-Path $PSScriptRoot 'get-release-version.ps1') -Root $Root
}

$distDir = Join-Path $Root 'dist'
if (-not (Test-Path $distDir)) {
    Write-Host "==> cleanup-dist-artifacts: no dist/, skip"
    return
}

$keepSetup = "LAN-Exam-Setup-v$Version.exe"
$keepLog = "package-$Version.log"
$removed = 0

Get-ChildItem $distDir -Filter 'LAN-Exam-Setup-v*.exe' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne $keepSetup } |
    ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Force
        Write-Host "==> removed stale installer: $($_.Name)"
        $removed++
    }

Get-ChildItem $distDir -Filter 'package-*.log' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne $keepLog } |
    ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Force
        Write-Host "==> removed stale log: $($_.Name)"
        $removed++
    }

Get-ChildItem $distDir -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^lan-exam-win-\d' } |
    ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Recurse -Force
        Write-Host "==> removed stale green package: $($_.Name)"
        $removed++
    }

if ($removed -eq 0) {
    Write-Host "==> cleanup-dist-artifacts: dist/ already clean for v$Version"
} else {
    Write-Host "==> cleanup-dist-artifacts: removed $removed item(s); kept $keepSetup"
}
