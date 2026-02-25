unit ServiceUnit;

interface

uses
  Winapi.Windows, Winapi.Messages, System.SysUtils, System.Classes, Vcl.Graphics, Vcl.Controls, Vcl.SvcMgr, Vcl.Dialogs,
  Vcl.ExtCtrls, ServerWorker, ProcessUtils;

type
  TMireDeskService = class(TService)
    WatchdogTimer: TTimer;
    procedure ServiceStart(Sender: TService; var Started: Boolean);
    procedure ServiceStop(Sender: TService; var Stopped: Boolean);
    procedure ServiceCreate(Sender: TObject);
    procedure ServiceDestroy(Sender: TObject);
    procedure WatchdogTimerTimer(Sender: TObject);
  private
    procedure CheckAndLaunchAgent;
    procedure CheckAndLaunchMireDesk;
  public
    function GetServiceController: TServiceController; override;
  end;

var
  MireService: TMireDeskService;

implementation

{$R *.dfm}

procedure ServiceController(CtrlCode: DWord); stdcall;
begin
  MireService.Controller(CtrlCode);
end;

function TMireDeskService.GetServiceController: TServiceController;
begin
  Result := ServiceController;
end;

procedure TMireDeskService.ServiceCreate(Sender: TObject);
begin
  DisplayName := 'MireDesk Native Service';
  Name := 'MireDeskService';
  WatchdogTimer.Interval := 2000;
end;

procedure TMireDeskService.ServiceDestroy(Sender: TObject);
begin
  // Cleanup handled in Stop
end;

procedure TMireDeskService.ServiceStart(Sender: TService; var Started: Boolean);
begin
  WatchdogTimer.Enabled := True;
  CheckAndLaunchAgent;
  CheckAndLaunchMireDesk;
  
  Started := True;
end;

procedure TMireDeskService.ServiceStop(Sender: TService; var Stopped: Boolean);
begin
  WatchdogTimer.Enabled := False;
  Stopped := True;
end;

procedure TMireDeskService.WatchdogTimerTimer(Sender: TObject);
begin
  CheckAndLaunchAgent;
  CheckAndLaunchMireDesk;
end;

procedure TMireDeskService.CheckAndLaunchAgent;
var
  AgentPath: string;
begin
  // The screen capture agent MUST have SYSTEM privileges to access Winlogon desktop
  if not IsProcessRunning('MireDeskAgent.exe') then
  begin
    AgentPath := ExtractFilePath(ParamStr(0)) + 'MireDeskAgent.exe';
    LogToFile('Agent not running. Attempting to start from: ' + AgentPath);
    if FileExists(AgentPath) then
    begin
      // Launch as SYSTEM in the active console session
      if LaunchProcessAsSystemInSession(AgentPath, GetActiveSessionID) then
        LogToFile('Successfully launched Agent.')
      else
        LogToFile('Failed to launch Agent.');
    end
    else
      LogToFile('Agent path not found: ' + AgentPath);
  end;
end;

procedure TMireDeskService.CheckAndLaunchMireDesk;
var
  MirePath: string;
  si: TStartupInfo;
  pi: TProcessInformation;
begin
  // The signaling app (Mire-Desk.exe) can run in Session 0 (Headless)
  if not IsProcessRunning('Mire-Desk.exe') then
  begin
    // Assuming structure: $INSTDIR\resources\bin\MireDeskService.exe
    // App is at: $INSTDIR\Mire-Desk.exe
    MirePath := ExpandFileName(ExtractFilePath(ParamStr(0)) + '..\..\Mire-Desk.exe');
    LogToFile('Mire-Desk not running. Trying Primary Path: ' + MirePath);
    
    // Fallback for development (same folder or relative)
    if not FileExists(MirePath) then
    begin
       MirePath := ExpandFileName(ExtractFilePath(ParamStr(0)) + '..\..\..\Mire-Desk.exe');
       LogToFile('Primary path not found. Trying Fallback Path: ' + MirePath);
    end;
    
    if FileExists(MirePath) then
    begin
      FillChar(si, SizeOf(si), 0);
      si.cb := SizeOf(si);
      // Launch as SYSTEM (Session 0) with --service flag
      if CreateProcess(nil, PChar('"' + MirePath + '" --service'), nil, nil, False, 0, nil, nil, si, pi) then
      begin
        LogToFile('Successfully launched headless Mire-Desk.');
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
      end
      else
        LogToFile('Failed to launch headless Mire-Desk. Error Code: ' + IntToStr(GetLastError()));
    end
    else
      LogToFile('Mire-Desk executable not found at any path.');
  end;
end;

end.
