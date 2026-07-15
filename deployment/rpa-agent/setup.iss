; setup.iss — Inno Setup script for MXV RPA Agent Installer
; See: https://jrsoftware.org/isinfo.php

[Setup]
AppId={{5A1E5C4E-7C12-4E38-B9FA-10A14E151A40}
AppName=MXV RPA Agent
AppVersion=1.0.0
AppPublisher=MXV
DefaultDirName={autopf}\MXV RPA Agent
DefaultGroupName=MXV RPA Agent
DisableProgramGroupPage=yes
OutputBaseFilename=MXV_Agent_Setup_v1.0
Compression=lzma
SolidCompression=yes
WizardStyle=modern
SetupIconFile=app\assets\icon.ico
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "vietnamese"; MessagesFile: "compiler:Languages\Vietnamese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "dist\MXVAgent.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "config.json"; DestDir: "{app}"; Flags: onlyifdoesntexist

[Icons]
Name: "{group}\MXV RPA Agent"; Filename: "{app}\MXVAgent.exe"
Name: "{autodesktop}\MXV RPA Agent"; Filename: "{app}\MXVAgent.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\MXVAgent.exe"; Description: "{cm:LaunchProgram,MXV RPA Agent}"; Flags: nowait postinstall skipifsilent
