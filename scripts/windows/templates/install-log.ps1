# Shared install/runtime logging for LAN Exam Windows package.
# Dot-source from scripts in the same directory: . (Join-Path $PSScriptRoot 'install-log.ps1')

function Get-InstallLogPaths {
    param([Parameter(Mandatory = $true)][string]$InstallHome)
    $root = $InstallHome.TrimEnd('\')
    $logDir = Join-Path $root 'logs'
    return @{
        InstallHome = $root
        LogDir      = $logDir
        InstallLog  = Join-Path $logDir 'install.log'
        AppLog      = Join-Path $logDir 'app.log'
        PostgresLog = Join-Path $logDir 'postgres.log'
        NodeStderr   = Join-Path $logDir 'node-stderr.log'
        SeedLog     = Join-Path $logDir 'seed.log'
        InitdbLog   = Join-Path $logDir 'initdb.log'
    }
}

function Get-InstallReleaseVersion {
    param([string]$InstallHome)
    $versionFile = Join-Path $InstallHome 'VERSION'
    if (Test-Path $versionFile) {
        return (Get-Content $versionFile -Raw).Trim()
    }
    return 'unknown'
}

function Initialize-InstallLogging {
    param(
        [Parameter(Mandatory = $true)][string]$InstallHome,
        [Parameter(Mandatory = $true)][string]$ScriptName,
        [string]$InvokeSource = 'unknown'
    )
    $paths = Get-InstallLogPaths -InstallHome $InstallHome
    if (-not (Test-Path $paths.LogDir)) {
        New-Item -ItemType Directory -Path $paths.LogDir -Force | Out-Null
    }

    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)

    return @{
        Paths         = $paths
        ScriptName    = $ScriptName
        InvokeSource  = $InvokeSource
        Version       = Get-InstallReleaseVersion -InstallHome $paths.InstallHome
        User          = $env:USERNAME
        Machine       = $env:COMPUTERNAME
        IsAdmin       = $isAdmin
        Utf8NoBom     = [System.Text.UTF8Encoding]::new($false)
    }
}

function Format-InstallLogLine {
    param(
        [string]$Level,
        [string]$ScriptName,
        [string]$Message
    )
    $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    return "[$stamp] [$Level] [$ScriptName] $Message"
}

function Write-InstallLogLine {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [ValidateSet('INFO', 'WARN', 'ERROR', 'STEP', 'OK', 'FAIL')]
        [string]$Level = 'INFO',
        [Parameter(Mandatory = $true)][string]$Message,
        [hashtable]$Data
    )
    $line = Format-InstallLogLine -Level $Level -ScriptName $Context.ScriptName -Message $Message
    if ($Data -and $Data.Count -gt 0) {
        $detail = ($Data.GetEnumerator() | ForEach-Object { "{0}={1}" -f $_.Key, $_.Value }) -join ' '
        $line += " | $detail"
    }
    [System.IO.File]::AppendAllText($Context.Paths.InstallLog, $line + [Environment]::NewLine, $Context.Utf8NoBom)

    $prefix = "[$($Context.ScriptName)]"
    switch ($Level) {
        'WARN' { Write-Warning "$prefix $Message" }
        'ERROR' { Write-Error "$prefix $Message" }
        'FAIL' { Write-Host "$prefix $Message" -ForegroundColor Red }
        'OK' { Write-Host "$prefix $Message" -ForegroundColor Green }
        'STEP' { Write-Host "=== $prefix $Message ===" -ForegroundColor Cyan }
        default { Write-Host "$prefix $Message" }
    }
}

function Write-InstallLogSessionStart {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [string]$Extra = ''
    )
    $msg = "session start invoke=$($Context.InvokeSource) version=$($Context.Version) user=$($Context.User) machine=$($Context.Machine) admin=$($Context.IsAdmin)"
    if ($Extra) { $msg += " $Extra" }
    Write-InstallLogLine -Context $Context -Level 'STEP' -Message $msg
    Write-InstallLogLine -Context $Context -Level 'INFO' -Message "installHome=$($Context.Paths.InstallHome)"
    Write-InstallLogLine -Context $Context -Level 'INFO' -Message "logFiles: install.log, app.log, postgres.log, node-stdout.log, node-stderr.log, seed.log, initdb.log"
}

function Write-InstallLogSessionEnd {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [bool]$Success = $true
    )
    $level = if ($Success) { 'OK' } else { 'FAIL' }
    Write-InstallLogLine -Context $Context -Level $level -Message 'session end'
}

function Write-InstallLogOutput {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)][string]$Label,
        $Output,
        [int]$ExitCode = 0,
        [string]$LogFile = ''
    )
    $target = if ($LogFile) { $LogFile } else { $Context.Paths.InstallLog }
    Write-InstallLogLine -Context $Context -Level 'INFO' -Message "$Label (exit=$ExitCode)"
    if ($null -eq $Output) { return }
    $text = (@($Output) | ForEach-Object { "$_" }) -join [Environment]::NewLine
    if (-not $text.Trim()) { return }
    $header = "--- $Label output ---"
    [System.IO.File]::AppendAllText($target, $header + [Environment]::NewLine, $Context.Utf8NoBom)
    [System.IO.File]::AppendAllText($target, $text + [Environment]::NewLine, $Context.Utf8NoBom)
    if ($ExitCode -ne 0) {
        Write-InstallLogLine -Context $Context -Level 'FAIL' -Message "$Label failed (exit=$ExitCode) — see $target"
    }
}

function Write-InstallLogException {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)]$ErrorRecord
    )
    Write-InstallLogLine -Context $Context -Level 'ERROR' -Message "FATAL: $($ErrorRecord.Exception.Message)"
    if ($ErrorRecord.ScriptStackTrace) {
        Write-InstallLogOutput -Context $Context -Label 'stack trace' -Output $ErrorRecord.ScriptStackTrace
    }
}

function Test-InstallPathLogged {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$Path
    )
    $exists = Test-Path $Path
    Write-InstallLogLine -Context $Context -Level $(if ($exists) { 'OK' } else { 'FAIL' }) -Message "$Label path=$Path exists=$exists"
    return $exists
}

# Run postgres.exe / pg_isready.exe / psql.exe without terminating on stderr or non-zero exit (pwsh 7+ native errors).
function Invoke-NativeCliQuiet {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$ArgumentList
    )
    $prevEap = $ErrorActionPreference
    $prevNative = $null
    if (Get-Variable -Name 'PSNativeCommandUseErrorActionPreference' -ErrorAction SilentlyContinue) {
        $prevNative = $PSNativeCommandUseErrorActionPreference
        $PSNativeCommandUseErrorActionPreference = $false
    }
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $FilePath @ArgumentList 2>$null
        $text = (@($output) | Out-String).Trim()
        $code = if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } else { 0 }
        return @{ Output = $text; ExitCode = $code }
    }
    finally {
        $ErrorActionPreference = $prevEap
        if ($null -ne $prevNative) { $PSNativeCommandUseErrorActionPreference = $prevNative }
    }
}

function Test-PostgresIsReady {
    param([Parameter(Mandatory = $true)][string]$InstallHome)
    $pgIsready = Join-Path $InstallHome 'runtime\postgres\bin\pg_isready.exe'
    if (-not (Test-Path $pgIsready)) {
        return [bool](netstat -ano | Select-String '127.0.0.1:5434' | Select-String 'LISTENING')
    }
    $r = Invoke-NativeCliQuiet -FilePath $pgIsready -ArgumentList @('-h', '127.0.0.1', '-p', '5434', '-U', 'postgres', '-q')
    return $r.ExitCode -eq 0
}

function Wait-PostgresAccepting {
    param(
        [Parameter(Mandatory = $true)][string]$InstallHome,
        [int]$TimeoutSeconds = 45
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PostgresIsReady -InstallHome $InstallHome) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Test-LanExamTeacherTable {
    param([Parameter(Mandatory = $true)][string]$InstallHome)
    $psql = Join-Path $InstallHome 'runtime\postgres\bin\psql.exe'
    if (-not (Test-Path $psql)) { return $false }
    if (-not (Test-PostgresIsReady -InstallHome $InstallHome)) { return $false }
    $r = Invoke-NativeCliQuiet -FilePath $psql -ArgumentList @(
        '-h', '127.0.0.1', '-p', '5434', '-U', 'lan_exam', '-d', 'lan_exam', '-w', '-X', '-tAc',
        "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Teacher'"
    )
    return $r.ExitCode -eq 0 -and $r.Output -eq '1'
}

# Test-Path on a junction can be true while the target (e.g. build-machine E:\ path) is missing on the target PC.
function Test-InstallFileReadable {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    try {
        $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $fs.Close()
        $fs.Dispose()
        return $true
    }
    catch {
        return $false
    }
}

function Resolve-PrismaCliPath {
    param([Parameter(Mandatory = $true)][string]$BundleDir)
    $BundleDir = $BundleDir.TrimEnd('\')
    $pnpmDir = Join-Path $BundleDir 'node_modules\.pnpm'
    if (Test-Path $pnpmDir) {
        $prismaPkg = Get-ChildItem $pnpmDir -Directory -Filter 'prisma@*' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($prismaPkg) {
            $real = Join-Path $prismaPkg.FullName 'node_modules\prisma\build\index.js'
            if (Test-InstallFileReadable -Path $real) { return $real }
        }
    }
    $hoisted = Join-Path $BundleDir 'node_modules\prisma\build\index.js'
    if (Test-InstallFileReadable -Path $hoisted) { return $hoisted }
    return $null
}

function Test-PrismaCliRunnable {
    param(
        [Parameter(Mandatory = $true)][string]$NodeExe,
        [Parameter(Mandatory = $true)][string]$PrismaCliPath,
        [Parameter(Mandatory = $true)][string]$BundleDir
    )
    if (-not (Test-InstallFileReadable -Path $PrismaCliPath)) { return $false }
    $pnpmNodeModules = Join-Path $BundleDir 'node_modules\.pnpm\node_modules'
    $nodePathParts = @(Join-Path $BundleDir 'node_modules')
    if (Test-Path $pnpmNodeModules) { $nodePathParts += $pnpmNodeModules }
    $prevNodePath = $env:NODE_PATH
    $env:NODE_PATH = $nodePathParts -join [IO.Path]::PathSeparator
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $NodeExe $PrismaCliPath 'version' 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $prevEap
        $env:NODE_PATH = $prevNodePath
    }
}
