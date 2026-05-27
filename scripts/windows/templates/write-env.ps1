param(
    [Parameter(Mandatory = $true)]
    [string]$InstallHome
)

$secret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
$content = @"
ADMIN_AUTH_MODE=disabled
LOCAL_ADMIN_USERNAME=local_exam_admin
ADMIN_API_LOOPBACK_ONLY=true
LISTEN_HOST=0.0.0.0
WEB_PORT=5180
DATABASE_URL=postgresql://lan_exam:lan_exam@127.0.0.1:5434/lan_exam
SESSION_SECRET=$secret
NODE_ENV=production
SERVE_WEB=true
WEB_DIST_PATH=
"@
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText((Join-Path $InstallHome '.env'), $content, $utf8NoBom)
