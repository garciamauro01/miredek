unit ServiceUtils;

interface

uses
  Winapi.Windows, Winapi.WinSvc, System.SysUtils, System.Classes;

procedure ExtractEmbeddedDLLs;

type
  TMireServiceStatus = (ssStopped, ssRunning, ssPaused, ssStartPending, ssStopPending, ssUnknown);

function GetMireDeskServiceStatus: TMireServiceStatus;
function StartMireDeskService: Boolean;
function StopMireDeskService: Boolean;

const
  MireDeskServiceName = 'MireDeskService';

implementation

function GetMireDeskServiceStatus: TMireServiceStatus;
var
  SCManager: SC_HANDLE;
  Service: SC_HANDLE;
  Status: SERVICE_STATUS_PROCESS;
  BytesNeeded: DWORD;
begin
  Result := ssUnknown;
  SCManager := OpenSCManager(nil, nil, SC_MANAGER_CONNECT);
  if SCManager <> 0 then
  try
    Service := OpenService(SCManager, PChar(MireDeskServiceName), SERVICE_QUERY_STATUS);
    if Service <> 0 then
    try
      if QueryServiceStatusEx(Service, SC_STATUS_PROCESS_INFO, PByte(@Status), SizeOf(Status), BytesNeeded) then
      begin
        case Status.dwCurrentState of
          SERVICE_STOPPED: Result := ssStopped;
          SERVICE_RUNNING: Result := ssRunning;
          SERVICE_PAUSED: Result := ssPaused;
          SERVICE_START_PENDING: Result := ssStartPending;
          SERVICE_STOP_PENDING: Result := ssStopPending;
        end;
      end;
    finally
      CloseServiceHandle(Service);
    end;
  finally
    CloseServiceHandle(SCManager);
  end;
end;

function StartMireDeskService: Boolean;
var
  SCManager: SC_HANDLE;
  Service: SC_HANDLE;
  Temp: PChar;
begin
  Result := False;
  SCManager := OpenSCManager(nil, nil, SC_MANAGER_CONNECT);
  if SCManager <> 0 then
  try
    Service := OpenService(SCManager, PChar(MireDeskServiceName), SERVICE_START);
    if Service <> 0 then
    try
      Temp := nil;
      Result := StartService(Service, 0, Temp);
    finally
      CloseServiceHandle(Service);
    end;
  finally
    CloseServiceHandle(SCManager);
  end;
end;

function StopMireDeskService: Boolean;
var
  SCManager: SC_HANDLE;
  Service: SC_HANDLE;
  Status: SERVICE_STATUS;
begin
  Result := False;
  SCManager := OpenSCManager(nil, nil, SC_MANAGER_CONNECT);
  if SCManager <> 0 then
  try
    Service := OpenService(SCManager, PChar(MireDeskServiceName), SERVICE_STOP);
    if Service <> 0 then
    try
      Result := ControlService(Service, SERVICE_CONTROL_STOP, Status);
    finally
      CloseServiceHandle(Service);
    end;
  finally
    CloseServiceHandle(SCManager);
  end;
end;

procedure ExtractResourceToFile(const ResourceName, FileName: string);
var
  RS: TResourceStream;
  FS: TFileStream;
begin
  if FileExists(FileName) then Exit;

  RS := TResourceStream.Create(HInstance, ResourceName, RT_RCDATA);
  try
    FS := TFileStream.Create(FileName, fmCreate);
    try
      FS.CopyFrom(RS, RS.Size);
    finally
      FS.Free;
    end;
  finally
    RS.Free;
  end;
end;

procedure ExtractEmbeddedDLLs;
var
  ExePath: string;
begin
  ExePath := ExtractFilePath(ParamStr(0));
  try
    ExtractResourceToFile('WEBVIEW2_LOADER', ExePath + 'WebView2Loader.dll');
    ExtractResourceToFile('SK4D_DLL', ExePath + 'sk4d.dll');
    ExtractResourceToFile('BRIDGE_HTML', ExePath + 'bridge.html');
  except
    // Log errors if necessary
  end;
end;

end.
