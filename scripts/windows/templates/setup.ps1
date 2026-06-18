param(
    [Parameter(Mandatory = $true)]
    [string]$InstallHome,
    [string]$InvokeSource = 'setup.bat',
    [switch]$SkipTrayLaunch,
    [switch]$SkipDesktopShortcut
)

$ErrorActionPreference = 'Stop'
$InstallHome = $InstallHome.TrimEnd('\')
$env:LAN_EXAM_HOME = $InstallHome

. (Join-Path $PSScriptRoot 'install-log.ps1')
$ctx = Initialize-InstallLogging -InstallHome $InstallHome -ScriptName 'setup' -InvokeSource $InvokeSource

function Invoke-SetupStep {
    param(
        [string]$Label,
        [scriptblock]$Action
    )
    Write-InstallLogLine -Context $ctx -Level 'STEP' -Message $Label
    & $Action
}

try {
    Write-InstallLogSessionStart -Context $ctx

    if (-not $ctx.IsAdmin) {
        Write-InstallLogLine -Context $ctx -Level 'WARN' -Message 'not running as Administrator; VC++ and firewall may fail'
        Write-Host '[setup] Run setup.bat as Administrator for VC++ and firewall.' -ForegroundColor Yellow
    }

    $vcredist = Join-Path $InstallHome 'runtime\vcredist\vc_redist.x64.exe'
    if (Test-Path $vcredist) {
        Invoke-SetupStep -Label 'install VC++ runtime' -Action {
            $proc = Start-Process -FilePath $vcredist -ArgumentList '/install', '/quiet', '/norestart' -Wait -PassThru
            Write-InstallLogLine -Context $ctx -Level 'INFO' -Message "vc_redist exit=$($proc.ExitCode)"
            if ($proc.ExitCode -notin 0, 1638, 3010) {
                throw "vc_redist.x64.exe failed (exit $($proc.ExitCode))"
            }
        }
    }
    else {
        Write-InstallLogLine -Context $ctx -Level 'WARN' -Message "vcredist missing at $vcredist"
    }

    $envPath = Join-Path $InstallHome '.env'
    if (-not (Test-Path $envPath)) {
        Invoke-SetupStep -Label 'write .env' -Action {
            & (Join-Path $PSScriptRoot 'write-env.ps1') -InstallHome $InstallHome -InvokeSource $InvokeSource
        }
    }
    else {
        Write-InstallLogLine -Context $ctx -Level 'INFO' -Message '.env already exists; skip write-env'
    }

    Invoke-SetupStep -Label 'initialize database' -Action {
        & (Join-Path $PSScriptRoot 'install-db.ps1') -InstallHome $InstallHome -InvokeSource $InvokeSource
    }

    Invoke-SetupStep -Label 'verify installation' -Action {
        & (Join-Path $PSScriptRoot 'verify-install.ps1') -InstallHome $InstallHome -InvokeSource $InvokeSource
    }

    Invoke-SetupStep -Label 'configure firewall TCP 5180' -Action {
        $ruleName = 'LAN Exam TCP 5180'
        $null = Start-Process -FilePath 'netsh' `
            -ArgumentList @('advfirewall', 'firewall', 'delete', 'rule', "name=$ruleName") `
            -Wait -WindowStyle Hidden -ErrorAction SilentlyContinue
        $fw = Start-Process -FilePath 'netsh' `
            -ArgumentList @(
                'advfirewall', 'firewall', 'add', 'rule', "name=$ruleName",
                'dir=in', 'action=allow', 'protocol=TCP', 'localport=5180',
                'profile=private,public,domain'
            ) `
            -Wait -PassThru -WindowStyle Hidden
        Write-InstallLogLine -Context $ctx -Level 'INFO' -Message "firewall rule exit=$($fw.ExitCode)"
        if ($fw.ExitCode -ne 0 -and -not $ctx.IsAdmin) {
            Write-InstallLogLine -Context $ctx -Level 'WARN' -Message 'firewall rule may have failed; allow TCP 5180 in wf.msc if needed'
        }
    }

    if (-not $SkipDesktopShortcut) {
        $tray = Join-Path $InstallHome 'LAN-Exam-Tray.exe'
        if (Test-Path $tray) {
            try {
                $desktop = [Environment]::GetFolderPath('Desktop')
                $lnk = Join-Path $desktop 'LAN-Exam.lnk'
                $shell = New-Object -ComObject WScript.Shell
                $shortcut = $shell.CreateShortcut($lnk)
                $shortcut.TargetPath = $tray
                $shortcut.WorkingDirectory = $InstallHome
                $shortcut.Description = 'LAN Exam'
                $shortcut.Save()
                Write-InstallLogLine -Context $ctx -Level 'INFO' -Message "desktop shortcut created path=$lnk"
            }
            catch {
                Write-InstallLogLine -Context $ctx -Level 'WARN' -Message "desktop shortcut failed: $($_.Exception.Message)"
            }
        }
    }

    Write-InstallLogLine -Context $ctx -Level 'OK' -Message 'setup completed'
    Write-InstallLogSessionEnd -Context $ctx -Success $true
    Write-Host ''
    Write-Host '[setup] Done. Admin: http://127.0.0.1:5180/admin' -ForegroundColor Green
    Write-Host '[setup] Daily start: LAN-Exam-Tray.exe or desktop shortcut.' -ForegroundColor Green

    if (-not $SkipTrayLaunch) {
        $tray = Join-Path $InstallHome 'LAN-Exam-Tray.exe'
        if (Test-Path $tray) {
            Start-Process -FilePath $tray -WorkingDirectory $InstallHome
        }
        else {
            Write-Host '[setup] LAN-Exam-Tray.exe not found; run start.bat instead.' -ForegroundColor Yellow
        }
    }

    exit 0
}
catch {
    Write-InstallLogException -Context $ctx -ErrorRecord $_
    Write-InstallLogSessionEnd -Context $ctx -Success $false
    Write-Host "[setup] Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host '[setup] See logs\install.log' -ForegroundColor Red
    exit 1
}
