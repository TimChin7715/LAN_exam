@echo off
setlocal
cd /d "%~dp0"
set "LAN_EXAM_HOME=%CD%"

echo.
echo  局域网考试系统 — 首次配置（绿色免安装版）
echo  目录: %LAN_EXAM_HOME%
echo  建议右键本文件，选择「以管理员身份运行」。
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%LAN_EXAM_HOME%\scripts\setup.ps1" -InstallHome "%LAN_EXAM_HOME%" -InvokeSource "setup.bat"
set "RC=%ERRORLEVEL%"
if %RC% neq 0 (
  echo.
  echo [setup] 配置未完成，请查看 logs\install.log
  pause
)
exit /b %RC%
