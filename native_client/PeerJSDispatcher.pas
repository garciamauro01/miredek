unit PeerJSDispatcher;

interface

uses
  System.SysUtils, System.Classes, System.JSON;

type
  TAuthStatus = (asOK, asFail);

  TAuthEvent = procedure(Sender: TObject; const RemoteID, Password: string) of object;
  TAuthStatusEvent = procedure(Sender: TObject; const RemoteID: string; Status: TAuthStatus) of object;
  TClipboardEvent = procedure(Sender: TObject; const RemoteID, Text: string) of object;
  TSourcesListEvent = procedure(Sender: TObject; const RemoteID: string; Sources: TJSONArray) of object;
  TMonitorChangedEvent = procedure(Sender: TObject; const RemoteID, ActiveSourceID: string) of object;
  TFileTransferEvent = procedure(Sender: TObject; const RemoteID: string; Data: TJSONObject) of object;
  TUnhandledMessageEvent = procedure(Sender: TObject; const RemoteID, MsgType: string; Data: TJSONObject) of object;

  TMireDispatcher = class
  private
    FOnAuthRequest: TAuthEvent;
    FOnAuthStatus: TAuthStatusEvent;
    FOnClipboardReceived: TClipboardEvent;
    FOnSourcesReceived: TSourcesListEvent;
    FOnMonitorChanged: TMonitorChangedEvent;
    FOnFileMessage: TFileTransferEvent;
    FOnUnhandledMessage: TUnhandledMessageEvent;
  public
    procedure DispatchMessage(const RemoteID: string; Data: TJSONValue);
    
    property OnAuthRequest: TAuthEvent read FOnAuthRequest write FOnAuthRequest;
    property OnAuthStatus: TAuthStatusEvent read FOnAuthStatus write FOnAuthStatus;
    property OnClipboardReceived: TClipboardEvent read FOnClipboardReceived write FOnClipboardReceived;
    property OnSourcesReceived: TSourcesListEvent read FOnSourcesReceived write FOnSourcesReceived;
    property OnMonitorChanged: TMonitorChangedEvent read FOnMonitorChanged write FOnMonitorChanged;
    property OnFileMessage: TFileTransferEvent read FOnFileMessage write FOnFileMessage;
    property OnUnhandledMessage: TUnhandledMessageEvent read FOnUnhandledMessage write FOnUnhandledMessage;
  end;

implementation

{ TMireDispatcher }

procedure TMireDispatcher.DispatchMessage(const RemoteID: string; Data: TJSONValue);
var
  JSONObj: TJSONObject;
  MsgType, StatusStr: string;
begin
  if not (Data is TJSONObject) then Exit;
  JSONObj := TJSONObject(Data);
  
  if not JSONObj.TryGetValue<string>('type', MsgType) then Exit;

  if MsgType = 'AUTH' then
  begin
    if Assigned(FOnAuthRequest) then
      FOnAuthRequest(Self, RemoteID, JSONObj.GetValue<string>('password'));
  end
  else if MsgType = 'CLIPBOARD' then
  begin
    if Assigned(FOnClipboardReceived) then
      FOnClipboardReceived(Self, RemoteID, JSONObj.GetValue<string>('text'));
  end
  else if MsgType = 'AUTH_STATUS' then
  begin
    if Assigned(FOnAuthStatus) then
    begin
      StatusStr := JSONObj.GetValue<string>('status');
      if StatusStr = 'OK' then
        FOnAuthStatus(Self, RemoteID, asOK)
      else
        FOnAuthStatus(Self, RemoteID, asFail);
    end;
  end
  else if MsgType = 'SOURCES_LIST' then
  begin
    if Assigned(FOnSourcesReceived) then
      FOnSourcesReceived(Self, RemoteID, TJSONArray(JSONObj.GetValue('sources')));
  end
  else if MsgType = 'MONITOR_CHANGED' then
  begin
    if Assigned(FOnMonitorChanged) then
      FOnMonitorChanged(Self, RemoteID, JSONObj.GetValue<string>('activeSourceId'));
  end
  else if MsgType.StartsWith('FILE_') then
  begin
    if Assigned(FOnFileMessage) then
      FOnFileMessage(Self, RemoteID, JSONObj);
  end
  else
  begin
    if Assigned(FOnUnhandledMessage) then
      FOnUnhandledMessage(Self, RemoteID, MsgType, JSONObj);
  end;
end;

end.
