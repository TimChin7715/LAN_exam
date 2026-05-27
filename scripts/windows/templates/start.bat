@echo off
setlocal
cd /d "%~dp0"
set "LAN_EXAM_HOME=%CD%"

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

powershell -NoProfile -ExecutionPolicy Bypass -File "%LAN_EXAM_HOME%\scripts\start-node.ps1" -InstallHome "%LAN_EXAM_HOME%"
exit /b %ERRORLEVEL%
