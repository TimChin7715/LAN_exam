; LAN Exam offline installer — compile on a build machine with Inno Setup 6.
;   ISCC.exe /DSourceDir=E:\programs\LAN_exam\dist\lan-exam-win /DAppVersion=1.6.0 LAN-Exam.iss
; Version: edit repo root VERSION; package.ps1 passes /DAppVersion automatically.

#ifndef SourceDir
  #define SourceDir "..\dist\lan-exam-win"
#endif

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

#ifndef AppVersionFull
  ; Windows VersionInfo requires four numeric segments (e.g. 1.6.0.0)
  #define AppVersionFull AppVersion + ".0"
#endif

[Setup]
AppName=局域网考试系统
AppVersion={#AppVersion}
AppVerName=局域网考试系统 {#AppVersion}
DefaultDirName=D:\LAN-Exam
DefaultGroupName=局域网考试系统
VersionInfoVersion={#AppVersionFull}
VersionInfoProductVersion={#AppVersion}
VersionInfoProductName=局域网考试系统
VersionInfoCompany=LAN Exam
OutputBaseFilename=LAN-Exam-Setup-v{#AppVersion}
OutputDir=..\dist
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
WizardStyle=modern

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: ".env"

[Icons]
Name: "{group}\局域网考试系统"; Filename: "{app}\LAN-Exam-Tray.exe"; WorkingDir: "{app}"
Name: "{commondesktop}\局域网考试系统"; Filename: "{app}\LAN-Exam-Tray.exe"; WorkingDir: "{app}"

[Run]
Filename: "{app}\runtime\vcredist\vc_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "安装运行库..."; Flags: waituntilterminated
Filename: "powershell"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\write-env.ps1"" -InstallHome ""{app}"""; StatusMsg: "生成配置..."; Flags: waituntilterminated
Filename: "{app}\install.bat"; WorkingDir: "{app}"; StatusMsg: "初始化数据库..."; Flags: waituntilterminated
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""LAN Exam TCP 5180"" dir=in action=allow protocol=TCP localport=5180 profile=private"; Flags: runhidden; StatusMsg: "配置防火墙..."
Filename: "{app}\LAN-Exam-Tray.exe"; Description: "启动局域网考试系统"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""LAN Exam TCP 5180"""; Flags: runhidden
