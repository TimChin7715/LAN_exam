param(
    [Parameter(Mandatory = $true)]
    [string]$InstallHome
)

$ErrorActionPreference = 'Continue'
$InstallHome = $InstallHome.TrimEnd('\')
$pgBin = Join-Path $InstallHome 'runtime\postgres\bin'
$pgData = Join-Path $InstallHome 'data\pg'
$logDir = Join-Path $InstallHome 'logs'
$stopLog = Join-Path $logDir 'stop.log'
$ourPostgresPrefix = (Join-Path $InstallHome 'runtime\postgres').ToLowerInvariant()

function Write-StopLog {
    param([string]$Message)
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Write-Host $line
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    Add-Content -Path $stopLog -Value $line -Encoding utf8
}

function Get-ListenerPidsOn5434 {
    @(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 5434 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
}

function Stop-OurPostgresProcesses {
    $candidates = @(
        Get-Process -Name postgres -ErrorAction SilentlyContinue
    )
    foreach ($proc in $candidates) {
        $path = $null
        try { $path = $proc.Path } catch { }
        if (-not $path) {
            $wmi = Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.Id)" -ErrorAction SilentlyContinue
            $path = $wmi?.ExecutablePath
        }
        if ($path -and $path.ToLowerInvariant().StartsWith($ourPostgresPrefix)) {
            Write-StopLog "[stop-postgres] Stop-Process postgres PID $($proc.Id) ($path)"
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

if (-not (Test-Path (Join-Path $pgData 'PG_VERSION'))) {
    Write-StopLog '[stop-postgres] PGDATA not initialized, skip.'
    exit 0
}

$pgCtl = Join-Path $pgBin 'pg_ctl.exe'
if (Test-Path $pgCtl) {
    Write-StopLog '[stop-postgres] pg_ctl -w -t 60 stop fast ...'
    $out = & $pgCtl -D $pgData -w -t 60 stop -m fast 2>&1
    foreach ($line in @($out)) {
        if ($null -ne $line -and "$line".Trim()) {
            Write-StopLog "  $line"
        }
    }
} else {
    Write-StopLog "[stop-postgres] pg_ctl not found at $pgCtl"
}

Start-Sleep -Milliseconds 500
Stop-OurPostgresProcesses

$stillListening = @(Get-ListenerPidsOn5434)
if ($stillListening.Count -gt 0) {
    Write-StopLog "[stop-postgres] 127.0.0.1:5434 still listening, force stop PIDs: $($stillListening -join ', ')"
    foreach ($listeningPid in $stillListening) {
        try {
            $proc = Get-Process -Id $listeningPid -ErrorAction SilentlyContinue
            $note = if ($proc) {
                try { $proc.ProcessName + ' ' + $proc.Path } catch { "PID $listeningPid" }
            } else {
                "PID $listeningPid"
            }
            Write-StopLog "  Stop-Process $note"
            Stop-Process -Id $listeningPid -Force -ErrorAction SilentlyContinue
        } catch {
            Write-StopLog "  Failed to stop PID ${listeningPid}: $($_.Exception.Message)"
        }
    }
    Start-Sleep -Seconds 1
}

$remaining = @(Get-ListenerPidsOn5434)
if ($remaining.Count -gt 0) {
    Write-StopLog "[stop-postgres] ERROR: port 5434 still in use (PIDs: $($remaining -join ', '))"
    exit 1
}

Write-StopLog '[stop-postgres] Postgres stopped.'
exit 0
