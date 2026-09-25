#define MyAppName "Finly"
#ifndef MyAppVersion
#define MyAppVersion "1.0.0"
#endif
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

[CustomMessages]
french.UninstallDataPrompt=Souhaitez-vous également supprimer vos données locales et votre base de données Finly (%APPDATA%\Finly) ?
english.UninstallDataPrompt=Do you also want to remove your local data and Finly database (%APPDATA%\Finly)?
french.UninstallShortCutName=Désinstaller Finly
english.UninstallShortCutName=Uninstall Finly

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Source compiled folder from PyInstaller --onedir
Source: "dist\Finly\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{autoprograms}\{#MyAppName}\{cm:UninstallShortCutName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    DataDir := ExpandConstant('{userappdata}\Finly');
    if DirExists(DataDir) then
    begin
      if MsgBox(CustomMessage('UninstallDataPrompt'), mbConfirmation, MB_YESNO) = IDYES then
      begin
        DelTree(DataDir, True, True, True);
      end;
    end;
  end;
end;
