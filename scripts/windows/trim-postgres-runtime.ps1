# Remove non-runtime directories from bundled EDB PostgreSQL (pgAdmin, docs, headers, etc.).
param(
    [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) {
    $OutDir = Join-Path $root 'dist\lan-exam-win'
}
$OutDir = [System.IO.Path]::GetFullPath($OutDir)
$pgRoot = Join-Path $OutDir 'runtime\postgres'

if (-not (Test-Path $pgRoot)) {
    throw "Postgres runtime missing: $pgRoot (run fetch-runtimes.ps1 first)"
}

function Get-DirStats {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        return @{ Files = 0; MB = 0 }
    }
    $files = Get-ChildItem -LiteralPath $Path -Recurse -File -Force -ErrorAction SilentlyContinue
    $bytes = ($files | Measure-Object -Property Length -Sum).Sum
    return @{
        Files = $files.Count
        MB    = [Math]::Round($bytes / 1MB, 1)
    }
}

function Remove-DirIfPresent {
    param(
        [string]$Path,
        [string]$Label
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Host "  skip (not present): $Label"
        return @{ Files = 0; MB = 0 }
    }
    $before = Get-DirStats -Path $Path
    Remove-Item -LiteralPath $Path -Recurse -Force
    Write-Host "  removed $Label ($($before.Files) files, $($before.MB) MB)"
    return $before
}

$beforeAll = Get-DirStats -Path $pgRoot
Write-Host "==> trim-postgres-runtime: before $($beforeAll.Files) files, $($beforeAll.MB) MB"

$removedFiles = 0
$removedMb = 0

foreach ($pgAdminDir in Get-ChildItem -LiteralPath $pgRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'pgAdmin*' }) {
    $stats = Remove-DirIfPresent -Path $pgAdminDir.FullName -Label $pgAdminDir.Name
    $removedFiles += $stats.Files
    $removedMb += $stats.MB
}

foreach ($entry in @(
        @{ Path = Join-Path $pgRoot 'doc'; Label = 'doc' },
        @{ Path = Join-Path $pgRoot 'include'; Label = 'include' },
        @{ Path = Join-Path $pgRoot 'StackBuilder'; Label = 'StackBuilder' },
        @{ Path = Join-Path $pgRoot 'share\locale'; Label = 'share\locale' }
    )) {
    $stats = Remove-DirIfPresent -Path $entry.Path -Label $entry.Label
    $removedFiles += $stats.Files
    $removedMb += $stats.MB
}

$afterAll = Get-DirStats -Path $pgRoot
Write-Host "==> trim-postgres-runtime: removed $removedFiles files, $([Math]::Round($removedMb, 1)) MB"
Write-Host "==> trim-postgres-runtime: after $($afterAll.Files) files, $($afterAll.MB) MB"

$requiredBin = @('initdb.exe', 'pg_ctl.exe', 'psql.exe', 'pg_isready.exe')
foreach ($bin in $requiredBin) {
    $path = Join-Path $pgRoot "bin\$bin"
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Postgres trim removed required binary: $path"
    }
}

$timezone = Join-Path $pgRoot 'share\timezone'
if (-not (Test-Path -LiteralPath $timezone)) {
    throw "Postgres trim removed required share/timezone: $timezone"
}
