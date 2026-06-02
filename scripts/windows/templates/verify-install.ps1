param(
    [Parameter(Mandatory = $true)]
    [string]$InstallHome,
    [string]$InvokeSource = 'inno-setup'
)

$ErrorActionPreference = 'Stop'
$InstallHome = $InstallHome.TrimEnd('\')
. (Join-Path $PSScriptRoot 'install-log.ps1')
$ctx = Initialize-InstallLogging -InstallHome $InstallHome -ScriptName 'verify-install' -InvokeSource $InvokeSource

function Test-HttpHealth {
    param([string]$Url, [int]$TimeoutSec = 8)
    try {
        $resp = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSec -UseBasicParsing
        $ok = $resp.StatusCode -eq 200 -and $resp.Content -match '"status"\s*:\s*"ok"'
        return @{ Ok = $ok; StatusCode = $resp.StatusCode; BodyPreview = ($resp.Content.Substring(0, [Math]::Min(120, $resp.Content.Length))) }
    }
    catch {
        return @{ Ok = $false; StatusCode = 0; BodyPreview = $_.Exception.Message }
    }
}

function Show-InstallLogTail {
    param([int]$Lines = 40)
    $path = $ctx.Paths.InstallLog
    if (-not (Test-Path $path)) { return }
    Write-InstallLogLine -Context $ctx -Level 'INFO' -Message "install.log tail (last $Lines lines):"
    $tail = Get-Content $path -Tail $Lines -ErrorAction SilentlyContinue
    Write-InstallLogOutput -Context $ctx -Label 'install.log tail' -Output $tail
}

try {
    Write-InstallLogSessionStart -Context $ctx
    $checksOk = $true

    $paths = @{
        'node.exe'           = Join-Path $InstallHome 'runtime\node\node.exe'
        'postgres pg_ctl'    = Join-Path $InstallHome 'runtime\postgres\bin\pg_ctl.exe'
        'server bundle'      = Join-Path $InstallHome 'app\server-bundle\dist\index.js'
        'web dist index'     = Join-Path $InstallHome 'app\web\dist\index.html'
        'prisma schema'      = Join-Path $InstallHome 'app\prisma\schema.prisma'
        'prisma CLI'         = Join-Path $InstallHome 'app\server-bundle\node_modules\prisma\build\index.js'
        'seed.cjs'           = Join-Path $InstallHome 'app\prisma\seed.cjs'
        '.env'               = Join-Path $InstallHome '.env'
        'VERSION'            = Join-Path $InstallHome 'VERSION'
        'install-db script'  = Join-Path $InstallHome 'scripts\install-db.ps1'
    }
    foreach ($entry in $paths.GetEnumerator()) {
        if (-not (Test-InstallPathLogged -Context $ctx -Label $entry.Key -Path $entry.Value)) {
            $checksOk = $false
        }
    }

    $bundle = Join-Path $InstallHome 'app\server-bundle'
    $nodeExe = Join-Path $InstallHome 'runtime\node\node.exe'
    $repairPrisma = Join-Path $InstallHome 'scripts\repair-prisma-bundle-links.ps1'
    if (Test-Path $repairPrisma) {
        & $repairPrisma -BundleDir $bundle
    }
    $prismaResolved = Resolve-PrismaCliPath -BundleDir $bundle
    if (-not $prismaResolved) {
        Write-InstallLogLine -Context $ctx -Level 'FAIL' -Message 'Prisma CLI not readable (junction target missing?)'
        $checksOk = $false
    }
    elseif (-not (Test-PrismaCliRunnable -NodeExe $nodeExe -PrismaCliPath $prismaResolved -BundleDir $bundle)) {
        Write-InstallLogLine -Context $ctx -Level 'FAIL' -Message "Prisma CLI exists but node cannot run: $prismaResolved"
        $checksOk = $false
    }
    else {
        Write-InstallLogLine -Context $ctx -Level 'OK' -Message "Prisma CLI runnable path=$prismaResolved"
    }

    $envPath = Join-Path $InstallHome '.env'
    if (Test-Path $envPath) {
        $keys = @()
        Get-Content $envPath | ForEach-Object {
            if ($_ -match '^\s*([^#][^=]+)=') { $keys += $matches[1].Trim() }
        }
        $required = @('ADMIN_AUTH_MODE', 'DATABASE_URL', 'SESSION_SECRET', 'WEB_PORT', 'NODE_ENV')
        foreach ($name in $required) {
            $present = $keys -contains $name
            Write-InstallLogLine -Context $ctx -Level $(if ($present) { 'OK' } else { 'FAIL' }) -Message ".env key $name present=$present"
            if (-not $present) { $checksOk = $false }
        }
        $secretLine = Get-Content $envPath | Where-Object { $_ -match '^\s*SESSION_SECRET=' } | Select-Object -First 1
        if ($secretLine -match 'SESSION_SECRET=(.+)$') {
            $len = $matches[1].Trim().Length
            Write-InstallLogLine -Context $ctx -Level $(if ($len -ge 16) { 'OK' } else { 'FAIL' }) -Message "SESSION_SECRET length=$len"
            if ($len -lt 16) { $checksOk = $false }
        }
    }

    Write-InstallLogLine -Context $ctx -Level 'STEP' -Message 'light database check (verify does not re-run full install-db if schema exists)'
    if (-not (Wait-PostgresAccepting -InstallHome $InstallHome -TimeoutSeconds 60)) {
        $checksOk = $false
        throw 'Postgres is not accepting connections on 127.0.0.1:5434 within 60s. See logs\postgres.log'
    }
    Write-InstallLogLine -Context $ctx -Level 'OK' -Message 'Postgres accepting connections'

    if (-not (Test-LanExamTeacherTable -InstallHome $InstallHome)) {
        Write-InstallLogLine -Context $ctx -Level 'STEP' -Message 'Teacher table missing — running ensure-db-ready once'
        $ensure = Join-Path $InstallHome 'scripts\ensure-db-ready.ps1'
        & $ensure -InstallHome $InstallHome
        if ($LASTEXITCODE -ne 0) {
            $checksOk = $false
            throw "ensure-db-ready failed (exit $LASTEXITCODE)"
        }
    }
    else {
        Write-InstallLogLine -Context $ctx -Level 'OK' -Message 'Teacher table present'
        $marker = Join-Path $InstallHome 'data\.install-db-complete'
        if (-not (Test-Path $marker)) {
            New-Item -ItemType File -Path $marker -Force | Out-Null
            Write-InstallLogLine -Context $ctx -Level 'INFO' -Message 'created .install-db-complete marker'
        }
    }

    $health = Test-HttpHealth -Url 'http://127.0.0.1:5180/health'
    if (-not $health.Ok) {
        Write-InstallLogLine -Context $ctx -Level 'STEP' -Message 'GET /health failed — starting node via start-node.ps1'
        $startNode = Join-Path $InstallHome 'scripts\start-node.ps1'
        & $startNode -InstallHome $InstallHome
        if ($LASTEXITCODE -ne 0) {
            Write-InstallLogLine -Context $ctx -Level 'WARN' -Message "start-node exit=$LASTEXITCODE"
        }
        $health = Test-HttpHealth -Url 'http://127.0.0.1:5180/health'
    }
    Write-InstallLogLine -Context $ctx -Level $(if ($health.Ok) { 'OK' } else { 'WARN' }) -Message "GET /health ok=$($health.Ok) status=$($health.StatusCode) preview=$($health.BodyPreview)"

    $logText = Get-Content $ctx.Paths.InstallLog -Raw -ErrorAction SilentlyContinue
    $installCompleted = $logText -match 'install completed'
    if ($installCompleted) {
        Write-InstallLogLine -Context $ctx -Level 'OK' -Message 'install.log contains install completed'
    }
    elseif ($health.Ok -and (Test-LanExamTeacherTable -InstallHome $InstallHome)) {
        Write-InstallLogLine -Context $ctx -Level 'OK' -Message 'verify passed via Teacher table + /health (install.log may lack install completed from interrupted prior step)'
    }
    else {
        $checksOk = $false
        Show-InstallLogTail
        throw "Verification failed: need install completed in log or Teacher table + /health ok. See $($ctx.Paths.InstallLog)"
    }

    if (-not $checksOk) {
        throw 'One or more file checks failed — see lines marked [FAIL] above'
    }

    Write-InstallLogLine -Context $ctx -Level 'OK' -Message 'verify-install passed'
    Write-InstallLogSessionEnd -Context $ctx -Success $true
    Write-Host '[verify-install] OK'
    exit 0
}
catch {
    Write-InstallLogException -Context $ctx -ErrorRecord $_
    Show-InstallLogTail
    Write-InstallLogSessionEnd -Context $ctx -Success $false
    throw
}
