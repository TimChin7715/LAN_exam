@echo off
setlocal
cd /d "%~dp0"

if not defined LAN_EXAM_HOME set "LAN_EXAM_HOME=%~dp0"
set "PG_BIN=%LAN_EXAM_HOME%\runtime\postgres\bin"
set "PGDATA=%LAN_EXAM_HOME%\data\pg"

echo [stop] Stopping Node on port 5180...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5180" ^| findstr "LISTENING"') do (
  taskkill /PID %%P /F >nul 2>&1
)

taskkill /FI "WINDOWTITLE eq LAN-Exam-Node*" /F >nul 2>&1

if exist "%PGDATA%\PG_VERSION" (
  echo [stop] Stopping Postgres...
  "%PG_BIN%\pg_ctl.exe" -D "%PGDATA%" stop fast >nul 2>&1
)

exit /b 0
