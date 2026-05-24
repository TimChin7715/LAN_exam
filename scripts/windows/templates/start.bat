@echo off
setlocal
cd /d "%~dp0"
set "LAN_EXAM_HOME=%CD%"

set "NODE=%LAN_EXAM_HOME%\runtime\node\node.exe"
set "PG_BIN=%LAN_EXAM_HOME%\runtime\postgres\bin"
set "PGDATA=%LAN_EXAM_HOME%\data\pg"
set "LOG_DIR=%LAN_EXAM_HOME%\logs"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

if not exist "%PGDATA%\PG_VERSION" (
  echo [start] Postgres data not initialized. Run install.bat first.
  exit /b 1
)

netstat -ano | findstr "127.0.0.1:5434" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo [start] Starting Postgres on 127.0.0.1:5434...
  start "" /B "%PG_BIN%\pg_ctl.exe" -D "%PGDATA%" -l "%LOG_DIR%\postgres.log" -o "-p 5434 -h 127.0.0.1" start >nul 2>&1
  timeout /t 3 /nobreak >nul
)

tasklist /FI "WINDOWTITLE eq LAN-Exam-Node*" 2>nul | find /I "node.exe" >nul
if errorlevel 1 (
  for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 5180 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess"`) do set "PID=%%F"
  if defined PID (
    echo [start] Port 5180 already in use by PID %PID%
  ) else (
    echo [start] Starting Node API + web on :5180...
    if exist "%LAN_EXAM_HOME%\.env" (
      for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B /V "^#" "%LAN_EXAM_HOME%\.env"`) do set "%%A=%%B"
    )
    set "NODE_ENV=production"
    set "SERVE_WEB=true"
    set "WEB_DIST_PATH=%LAN_EXAM_HOME%\app\web\dist"
    set "NODE_PATH=%LAN_EXAM_HOME%\app\server-bundle\node_modules"
    cd /d "%LAN_EXAM_HOME%\app"
    start "LAN-Exam-Node" /MIN "%NODE%" "server-bundle\dist\index.js" >> "%LOG_DIR%\app.log" 2>&1
  )
)

exit /b 0
