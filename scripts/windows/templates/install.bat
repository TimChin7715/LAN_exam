@echo off
setlocal
cd /d "%~dp0"
set "LAN_EXAM_HOME=%CD%"

if not exist "%LAN_EXAM_HOME%\.env" (
  echo [install] .env missing — generating...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%LAN_EXAM_HOME%\scripts\write-env.ps1" -InstallHome "%LAN_EXAM_HOME%" -InvokeSource "install.bat"
  if errorlevel 1 exit /b %ERRORLEVEL%
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%LAN_EXAM_HOME%\scripts\install-db.ps1" -InstallHome "%LAN_EXAM_HOME%" -InvokeSource "install.bat"
exit /b %ERRORLEVEL%
