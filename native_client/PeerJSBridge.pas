unit PeerJSBridge;

interface

uses
  System.SysUtils, System.Classes, Winapi.Windows, Winapi.WebView2, Winapi.ActiveX,
  Vcl.Edge, System.JSON;

type
  { Event types for communication back to the UI }
  TPeerOpenEvent = procedure(Sender: TObject; const PeerID: string) of object;
  TPeerConnectionEvent = procedure(Sender: TObject; const RemoteID: string) of object;
  TPeerConnOpenEvent = procedure(Sender: TObject; const RemoteID: string) of object;
  TPeerConnCloseEvent = procedure(Sender: TObject; const RemoteID: string) of object;
  TPeerDataEvent = procedure(Sender: TObject; const RemoteID: string; Data: TJSONValue) of object;
  TPeerVideoEvent = procedure(Sender: TObject; const RemoteID: string) of object;
  TPeerErrorEvent = procedure(Sender: TObject; const ErrorMsg: string) of object;
  TPeerLogEvent = procedure(Sender: TObject; const Msg: string) of object;
  TPeerOnlineStatusEvent = procedure(Sender: TObject; const RemoteID: string; IsOnline: Boolean) of object;

  TMirePeerBridge = class(TObject)
  private
    FEdge: TEdgeBrowser;
    FOnPeerOpen: TPeerOpenEvent;
    FOnPeerConnection: TPeerConnectionEvent;
    FOnConnOpen: TPeerConnOpenEvent;
    FOnConnClose: TPeerConnCloseEvent;
    FOnDataReceived: TPeerDataEvent;
    FOnVideoStarted: TPeerVideoEvent;
    FOnError: TPeerErrorEvent;
    FOnLog: TPeerLogEvent;
    FOnBridgeReady: TNotifyEvent;
    FOnOnlineStatus: TPeerOnlineStatusEvent;

    procedure HandleWebMessageReceived(Sender: TCustomEdgeBrowser; Args: TWebMessageReceivedEventArgs);

    procedure ExecuteScript(const Script: string);
  public
    constructor Create(AEdgeBrowser: TEdgeBrowser);
    
    { Commands to PeerJS }
    procedure SendCommand(const Cmd: string; Args: TJSONObject);
    procedure Initialize(const Host: string; Port: Integer; const Path: string; const ID: string = '');
    procedure Connect(const RemoteID: string);
    procedure SendToWeb(const MsgType: string; Args: TJSONObject);
    procedure StartVideo(const SourceURL: string = '');
    procedure SendData(const RemoteID: string; const Payload: string);
    procedure SendDataJSON(const RemoteID: string; Payload: TJSONObject);
    procedure CheckOnline(const RemoteID: string); overload;
    procedure CheckOnline(const RemoteIDs: TJSONArray); overload;

    { Events }
    property OnPeerOpen: TPeerOpenEvent read FOnPeerOpen write FOnPeerOpen;
    property OnPeerConnection: TPeerConnectionEvent read FOnPeerConnection write FOnPeerConnection;
    property OnConnOpen: TPeerConnOpenEvent read FOnConnOpen write FOnConnOpen;
    property OnConnClose: TPeerConnCloseEvent read FOnConnClose write FOnConnClose;
    property OnDataReceived: TPeerDataEvent read FOnDataReceived write FOnDataReceived;
    property OnVideoStarted: TPeerVideoEvent read FOnVideoStarted write FOnVideoStarted;
    property OnError: TPeerErrorEvent read FOnError write FOnError;
    property OnLog: TPeerLogEvent read FOnLog write FOnLog;
    property OnBridgeReady: TNotifyEvent read FOnBridgeReady write FOnBridgeReady;
    property OnOnlineStatus: TPeerOnlineStatusEvent read FOnOnlineStatus write FOnOnlineStatus;
  end;

implementation

{ TMirePeerBridge }

constructor TMirePeerBridge.Create(AEdgeBrowser: TEdgeBrowser);
begin
  inherited Create;
  FEdge := AEdgeBrowser;
  FEdge.OnWebMessageReceived := HandleWebMessageReceived;
end;

procedure TMirePeerBridge.HandleWebMessageReceived(Sender: TCustomEdgeBrowser; Args: TWebMessageReceivedEventArgs);
var
  JSON: TJSONObject;
  MsgType: string;
  DataObj: TJSONObject;
  LMessage: PWideChar;
begin
  try
    // Accessing via the COM interface is more reliable in some Delphi 12 versions
    if Succeeded(Args.ArgsInterface.Get_WebMessageAsJson(LMessage)) then
    try
      JSON := TJSONObject.ParseJSONValue(string(LMessage)) as TJSONObject;
      if not Assigned(JSON) then Exit;

    try
      MsgType := JSON.GetValue<string>('type');
      DataObj := JSON.GetValue<TJSONObject>('data');

      if MsgType = 'BRIDGE_READY' then
      begin
        if Assigned(FOnBridgeReady) then FOnBridgeReady(Self);
      end
      else if MsgType = 'PEER_OPEN' then
      begin
        if Assigned(FOnPeerOpen) then FOnPeerOpen(Self, DataObj.GetValue<string>('id'));
      end
      else if MsgType = 'PEER_CONNECTION' then
      begin
        if Assigned(FOnPeerConnection) then FOnPeerConnection(Self, DataObj.GetValue<string>('remoteId'));
      end
      else if MsgType = 'CONN_OPEN' then
      begin
        if Assigned(FOnConnOpen) then FOnConnOpen(Self, DataObj.GetValue<string>('remoteId'));
      end
      else if MsgType = 'CONN_CLOSE' then
      begin
        if Assigned(FOnConnClose) then FOnConnClose(Self, DataObj.GetValue<string>('remoteId'));
      end
      else if MsgType = 'CONN_DATA' then
      begin
        if Assigned(FOnDataReceived) then
          FOnDataReceived(Self, DataObj.GetValue<string>('remoteId'), DataObj.GetValue('payload'));
      end
      else if MsgType = 'VIDEO_STREAM_STARTED' then
      begin
        if Assigned(FOnVideoStarted) then FOnVideoStarted(Self, DataObj.GetValue<string>('remoteId'));
      end
      else if MsgType = 'PEER_ERROR' then
      begin
        if Assigned(FOnError) then FOnError(Self, DataObj.GetValue<string>('error'));
      end
      else if MsgType = 'LOG' then
      begin
        if Assigned(FOnLog) then FOnLog(Self, DataObj.GetValue<string>('message'));
      end
      else if MsgType = 'ONLINE_STATUS' then
      begin
        if Assigned(FOnOnlineStatus) then 
          FOnOnlineStatus(Self, DataObj.GetValue<string>('id'), DataObj.GetValue<Boolean>('status'));
      end;
      finally
        JSON.Free;
      end;
    finally
      CoTaskMemFree(LMessage);
    end;
  except
    // Log error parsing JSON if needed
  end;
end;

procedure TMirePeerBridge.SendCommand(const Cmd: string; Args: TJSONObject);
var
  Msg: TJSONObject;
begin
  Msg := TJSONObject.Create;
  try
    Msg.AddPair('cmd', Cmd);
    if Assigned(Args) then
      Msg.AddPair('args', Args)
    else
      Msg.AddPair('args', TJSONObject.Create);

    if Assigned(FEdge.DefaultInterface) then
      FEdge.DefaultInterface.PostWebMessageAsJson(PChar(Msg.ToJSON));
  finally
    Msg.Free;
  end;
end;

procedure TMirePeerBridge.SendToWeb(const MsgType: string; Args: TJSONObject);
var
  Msg: TJSONObject;
begin
  Msg := TJSONObject.Create;
  try
    Msg.AddPair('cmd', MsgType);
    if Assigned(Args) then
      Msg.AddPair('args', Args)
    else
      Msg.AddPair('args', TJSONObject.Create);

    if Assigned(FEdge.DefaultInterface) then
      FEdge.DefaultInterface.PostWebMessageAsJson(PChar(Msg.ToJSON));
  finally
    Msg.Free;
  end;
end;

procedure TMirePeerBridge.ExecuteScript(const Script: string);
begin
  FEdge.ExecuteScript(Script);
end;

procedure TMirePeerBridge.Initialize(const Host: string; Port: Integer; const Path: string; const ID: string);
var
  Args: TJSONObject;
begin
  Args := TJSONObject.Create;
  Args.AddPair('host', Host);
  Args.AddPair('port', TJSONNumber.Create(Port));
  Args.AddPair('path', Path);
  if ID <> '' then
    Args.AddPair('id', ID);
    
  SendCommand('INIT', Args);
end;

procedure TMirePeerBridge.Connect(const RemoteID: string);
var
  Args: TJSONObject;
begin
  Args := TJSONObject.Create;
  Args.AddPair('remoteId', RemoteID);
  SendCommand('CONNECT', Args);
end;

procedure TMirePeerBridge.StartVideo(const SourceURL: string);
var
  Args: TJSONObject;
begin
  Args := TJSONObject.Create;
  if SourceURL <> '' then
    Args.AddPair('url', SourceURL);
  SendCommand('START_VIDEO', Args);
end;

procedure TMirePeerBridge.SendData(const RemoteID, Payload: string);
var
  Args: TJSONObject;
begin
  Args := TJSONObject.Create;
  Args.AddPair('remoteId', RemoteID);
  Args.AddPair('payload', Payload);
  SendCommand('SEND', Args);
end;

procedure TMirePeerBridge.SendDataJSON(const RemoteID: string; Payload: TJSONObject);
var
  Args: TJSONObject;
begin
  Args := TJSONObject.Create;
  Args.AddPair('remoteId', RemoteID);
  Args.AddPair('payload', Payload.Clone as TJSONObject);
  SendCommand('SEND', Args);
end;

procedure TMirePeerBridge.CheckOnline(const RemoteID: string);
var
  Args: TJSONObject;
begin
  Args := TJSONObject.Create;
  Args.AddPair('remoteId', RemoteID);
  SendCommand('CHECK_ONLINE', Args);
end;

procedure TMirePeerBridge.CheckOnline(const RemoteIDs: TJSONArray);
var
  Args: TJSONObject;
begin
  Args := TJSONObject.Create;
  Args.AddPair('remoteId', RemoteIDs);
  SendCommand('CHECK_ONLINE', Args);
end;

end.
