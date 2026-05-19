@echo off
setlocal
cd /d "%~dp0"

if not defined LAN_EXAM_HOME set "LAN_EXAM_HOME=%~dp0"
set "LAN_EXAM_HOME=%LAN_EXAM_HOME:~0,-1%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%LAN_EXAM_HOME%\scripts\install-db.ps1" -InstallHome "%LAN_EXAM_HOME%"
exit /b %ERRORLEVEL%
