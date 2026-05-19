; LAN Exam offline installer — compile on a build machine with Inno Setup 6.
;   ISCC.exe /DSourceDir=E:\programs\LAN_exam\dist\lan-exam-win LAN-Exam.iss

#ifndef SourceDir
  #define SourceDir "..\dist\lan-exam-win"
#endif

[Setup]
AppName=局域网考试系统
AppVersion=0.1.0
DefaultDirName=D:\LAN-Exam
DefaultGroupName=局域网考试系统
OutputBaseFilename=LAN-Exam-Setup
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
