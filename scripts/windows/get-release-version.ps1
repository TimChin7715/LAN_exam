# Reads release version from repo root VERSION (fallback: package.json).
param(
    [string]$Root = ''
)

$ErrorActionPreference = 'Stop'
if (-not $Root) {
    $Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
}

$versionFile = Join-Path $Root 'VERSION'
if (Test-Path $versionFile) {
    $v = (Get-Content $versionFile -Raw -Encoding UTF8).Trim()
    if ($v) {
        return $v
    }
}

$pkgPath = Join-Path $Root 'package.json'
if (Test-Path $pkgPath) {
    $pkg = Get-Content $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($pkg.version) {
        return [string]$pkg.version
    }
}

throw 'Release version not found. Add a VERSION file or package.json version.'
