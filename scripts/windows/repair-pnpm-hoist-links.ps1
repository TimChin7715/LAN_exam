# Recreates pnpm hoist junctions under node_modules/.pnpm/node_modules (broken by Copy-Item / robocopy).
param(
    [Parameter(Mandatory = $true)]
    [string]$BundleDir
)

$ErrorActionPreference = 'Stop'
$BundleDir = [System.IO.Path]::GetFullPath($BundleDir)
$pnpmDir = Join-Path $BundleDir 'node_modules\.pnpm'
$hoistDir = Join-Path $pnpmDir 'node_modules'
if (-not (Test-Path $hoistDir)) {
    Write-Host "==> repair-pnpm-hoist-links: no hoist dir, skip ($BundleDir)"
    return
}

function Get-PnpmStoreDirName {
    param([string]$PackageName)
    if ($PackageName.StartsWith('@')) {
        return ($PackageName -replace '/', '+')
    }
    return $PackageName
}

function Set-JunctionLink {
    param([string]$Link, [string]$Target)
    if (-not (Test-Path $Target)) {
        throw "Hoist link target missing: $Target"
    }
    if (Test-Path $Link) {
        $item = Get-Item -LiteralPath $Link -Force
        if ($item.LinkType -eq 'Junction' -and $item.Target -contains $Target) { return $false }
        Remove-Item -LiteralPath $Link -Recurse -Force
    }
    New-Item -ItemType Directory -Path (Split-Path $Link) -Force | Out-Null
    New-Item -ItemType Junction -Path $Link -Target $Target | Out-Null
    return $true
}

$fixed = 0
Get-ChildItem $hoistDir -Force | ForEach-Object {
    $name = $_.Name
    $storePrefix = Get-PnpmStoreDirName -PackageName $name
    $pkgDir = Get-ChildItem $pnpmDir -Directory -Filter "$storePrefix@*" -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $pkgDir) { return }
    $target = Join-Path $pkgDir.FullName "node_modules\$name"
    if (-not (Test-Path $target)) { return }
    if (Set-JunctionLink -Link $_.FullName -Target $target) { $fixed++ }
}

Write-Host "==> repair-pnpm-hoist-links OK: $BundleDir ($fixed junctions repaired)"
