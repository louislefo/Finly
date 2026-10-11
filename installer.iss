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
french.AIAssistantGroup=Assistant IA Optionnel
english.AIAssistantGroup=Optional AI Assistant
french.InstallOllamaDescription=Installer le moteur IA local Ollama (100% privé, optionnel - nécessite 8 Go RAM min)
english.InstallOllamaDescription=Install local Ollama AI engine (100% private, optional - requires 8 GB RAM min)
french.OllamaDisclaimer=Note : L'IA locale dépend de votre matériel. Les clés API cloud (OpenAI, Claude, Mistral) restent configurables dans l'application.
english.OllamaDisclaimer=Note: Local AI depends on your hardware. Cloud API keys (OpenAI, Claude, Mistral) remain configurable in the app.

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "installollama"; Description: "{cm:InstallOllamaDescription}"; GroupDescription: "{cm:AIAssistantGroup}"; Flags: unchecked; Check: ShouldOfferOllamaInstall

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
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoProfile -Command ""$p = [System.IO.Path]::Combine($env:TEMP, 'OllamaSetup.exe'); (New-Object System.Net.WebClient).DownloadFile('https://ollama.com/download/OllamaSetup.exe', $p); Start-Process -FilePath $p -ArgumentList '/SILENT' -Wait"""; StatusMsg: "Telechargement et installation d Ollama..."; Flags: runhidden; Tasks: installollama
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall

[Code]
function IsOllamaInstalled(): Boolean;
begin
  Result := FileExists(ExpandConstant('{localappdata}\Programs\Ollama\ollama.exe')) or
            FileExists(ExpandConstant('{pf}\Ollama\ollama.exe')) or
            FileExists(ExpandConstant('{pf64}\Ollama\ollama.exe'));
end;

function ShouldOfferOllamaInstall(): Boolean;
begin
  Result := not IsOllamaInstalled();
end;

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
