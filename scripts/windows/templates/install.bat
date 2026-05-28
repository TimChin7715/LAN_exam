@echo off
setlocal
cd /d "%~dp0"
set "LAN_EXAM_HOME=%CD%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%LAN_EXAM_HOME%\scripts\install-db.ps1" -InstallHome "%LAN_EXAM_HOME%" -InvokeSource "install.bat"
exit /b %ERRORLEVEL%
