# Ensures Prisma CLI can resolve @prisma/engines in an offline pnpm deploy layout.
param(
    [Parameter(Mandatory = $true)]
    [string]$BundleDir
)

$ErrorActionPreference = 'Stop'
$BundleDir = [System.IO.Path]::GetFullPath($BundleDir)
$nodeModules = Join-Path $BundleDir 'node_modules'
$pnpmDir = Join-Path $nodeModules '.pnpm'

function Set-JunctionLink {
    param([string]$Link, [string]$Target)
    if (-not (Test-Path $Target)) {
        throw "Prisma link target missing: $Target"
    }
    if (Test-Path $Link) {
        $item = Get-Item -LiteralPath $Link -Force
        if ($item.LinkType -eq 'Junction' -and $item.Target -contains $Target) { return }
        Remove-Item -LiteralPath $Link -Recurse -Force
    }
    New-Item -ItemType Directory -Path (Split-Path $Link) -Force | Out-Null
    New-Item -ItemType Junction -Path $Link -Target $Target | Out-Null
}

$enginesPkg = Get-ChildItem $pnpmDir -Directory -Filter '@prisma+engines@*' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $enginesPkg) { throw "Missing @prisma+engines package under $pnpmDir" }
$enginesTarget = Join-Path $enginesPkg.FullName 'node_modules\@prisma\engines'
Set-JunctionLink -Link (Join-Path $nodeModules '@prisma\engines') -Target $enginesTarget

$prismaPkg = Get-ChildItem $pnpmDir -Directory -Filter 'prisma@*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($prismaPkg) {
    $prismaTarget = Join-Path $prismaPkg.FullName 'node_modules\prisma'
    if (Test-Path $prismaTarget) {
        Set-JunctionLink -Link (Join-Path $nodeModules 'prisma') -Target $prismaTarget
    }
}

Write-Host "==> repair-prisma-bundle-links OK: $BundleDir"
