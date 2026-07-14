# Keep only portable Node runtime files needed by install/start scripts (node.exe + DLLs).
param(
    [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) {
    $OutDir = Join-Path $root 'dist\lan-exam-win'
}
$OutDir = [System.IO.Path]::GetFullPath($OutDir)
$nodeRoot = Join-Path $OutDir 'runtime\node'

if (-not (Test-Path $nodeRoot)) {
    throw "Node runtime missing: $nodeRoot (run fetch-runtimes.ps1 first)"
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

$beforeAll = Get-DirStats -Path $nodeRoot
Write-Host "==> trim-node-runtime: before $($beforeAll.Files) files, $($beforeAll.MB) MB"

$nodeExe = Join-Path $nodeRoot 'node.exe'
if (-not (Test-Path -LiteralPath $nodeExe)) {
    throw "node.exe missing: $nodeExe"
}

$keepFiles = @{}
Get-ChildItem -LiteralPath $nodeRoot -File -Force | ForEach-Object {
    if ($_.Extension -eq '.exe' -or $_.Extension -eq '.dll') {
        $keepFiles[$_.Name] = $true
    }
}
if (-not $keepFiles.ContainsKey('node.exe')) {
    throw 'node.exe not found in runtime/node'
}

$removedFiles = 0
$removedMb = 0

$nodeModules = Join-Path $nodeRoot 'node_modules'
if (Test-Path -LiteralPath $nodeModules) {
    $stats = Get-DirStats -Path $nodeModules
    Remove-Item -LiteralPath $nodeModules -Recurse -Force
    $removedFiles += $stats.Files
    $removedMb += $stats.MB
    Write-Host "  removed node_modules ($($stats.Files) files, $($stats.MB) MB)"
}

Get-ChildItem -LiteralPath $nodeRoot -Force | ForEach-Object {
    if ($_.PSIsContainer) {
        $stats = Get-DirStats -Path $_.FullName
        Remove-Item -LiteralPath $_.FullName -Recurse -Force
        $removedFiles += $stats.Files
        $removedMb += $stats.MB
        Write-Host "  removed dir $($_.Name) ($($stats.Files) files, $($stats.MB) MB)"
        return
    }
    if ($keepFiles.ContainsKey($_.Name)) { return }
    $removedFiles++
    $removedMb += [Math]::Round($_.Length / 1MB, 1)
    Remove-Item -LiteralPath $_.FullName -Force
    Write-Host "  removed file $($_.Name)"
}

$afterAll = Get-DirStats -Path $nodeRoot
Write-Host "==> trim-node-runtime: removed $removedFiles files, $([Math]::Round($removedMb, 1)) MB"
Write-Host "==> trim-node-runtime: after $($afterAll.Files) files, $($afterAll.MB) MB"

$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$versionOutput = & $nodeExe -e "console.log(process.version)" 2>&1
$exitCode = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($exitCode -ne 0) {
    throw "node.exe smoke test failed (exit $exitCode): $versionOutput"
}
Write-Host "==> trim-node-runtime: node smoke OK ($($versionOutput.Trim()))"
