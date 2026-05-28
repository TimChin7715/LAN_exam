# Fails the build if install/runtime PowerShell scripts have syntax errors.
param(
    [string]$TemplatesDir = ''
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $TemplatesDir) {
    $TemplatesDir = Join-Path $PSScriptRoot 'templates'
}

$files = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
Get-ChildItem (Join-Path $TemplatesDir '*.ps1') -File | ForEach-Object { $files.Add($_) }
$files.Add((Get-Item (Join-Path $PSScriptRoot 'repair-prisma-bundle-links.ps1')))
$files.Add((Get-Item (Join-Path $PSScriptRoot 'repair-pnpm-hoist-links.ps1')))
$files.Add((Get-Item (Join-Path $PSScriptRoot 'verify-package.ps1')))

$failed = $false
foreach ($file in $files) {
    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile(
        $file.FullName, [ref]$tokens, [ref]$errors)
    if ($errors) {
        $failed = $true
        Write-Host "SYNTAX ERROR: $($file.FullName)" -ForegroundColor Red
        foreach ($err in $errors) {
            Write-Host "  line $($err.Extent.StartLineNumber): $($err.Message)"
        }
    }
}

if ($failed) { throw 'PowerShell script syntax validation failed' }
Write-Host '==> validate-install-scripts: all OK'
