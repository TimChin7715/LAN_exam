@echo off
setlocal
cd /d "%~dp0"
set "LAN_EXAM_HOME=%CD%"
set "LOG_DIR=%LAN_EXAM_HOME%\logs"
set "STOP_ERR=0"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo [stop] Stopping Node on port 5180...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5180" ^| findstr "LISTENING"') do (
  taskkill /PID %%P /F >nul 2>&1
)

taskkill /FI "WINDOWTITLE eq LAN-Exam-Node*" /F >nul 2>&1

if exist "%LAN_EXAM_HOME%\data\pg\PG_VERSION" (
  echo [stop] Stopping Postgres...
  if exist "%LAN_EXAM_HOME%\scripts\stop-postgres.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%LAN_EXAM_HOME%\scripts\stop-postgres.ps1" -InstallHome "%LAN_EXAM_HOME%"
    if errorlevel 1 set "STOP_ERR=1"
  ) else (
    set "PG_BIN=%LAN_EXAM_HOME%\runtime\postgres\bin"
    set "PGDATA=%LAN_EXAM_HOME%\data\pg"
    "%PG_BIN%\pg_ctl.exe" -D "%PGDATA%" -w -t 60 stop -m fast >nul 2>&1
    if errorlevel 1 set "STOP_ERR=1"
  )
)

if "%STOP_ERR%"=="1" (
  echo [stop] WARNING: Postgres may still be running. See logs\stop.log
  exit /b 1
)

echo [stop] Done.
exit /b 0
