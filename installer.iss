#define MyAppName "Finly"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Finly"
#define MyAppURL "https://github.com/louislefo/Finly"
#define MyAppExeName "Finly.exe"

[Setup]
; App Metadata
AppId={{C8E1B920-5712-4C7D-89F1-2B7A8C90A812}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Modern User Installation (Installs in user profile without requiring Administrator elevation)
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\{#MyAppName}
DisableProgramGroupPage=yes
DefaultGroupName={#MyAppName}

; Output Configuration
OutputDir=dist-installer
OutputBaseFilename=Finly-Setup
SetupIconFile=finly-app\public\favicon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

; High-Ratio Ultra LZMA2 Solid Compression for small setup size
Compression=lzma2/ultra64
SolidCompression=yes

; Modern UI Style
WizardStyle=modern
DisableWelcomePage=no
CloseApplications=force

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Source compiled folder from PyInstaller --onedir
Source: "dist\Finly\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
