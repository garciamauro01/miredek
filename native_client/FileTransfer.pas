unit FileTransfer;

interface

uses
  System.Classes, System.SysUtils, System.JSON, System.Math, System.Generics.Collections, System.NetEncoding, System.IOUtils;

type
  TTransferState = (tsPending, tsTransferring, tsCompleted, tsCancelled, tsError);
  TTransferDirection = (tdIncoming, tdOutgoing);

  TFileTransfer = class
  public
    ID: string; // Unique Transfer ID
    PeerID: string;
    FilePath: string;
    FileName: string;
    FileSize: Int64;
    BytesTransferred: Int64;
    Direction: TTransferDirection;
    State: TTransferState;
    FileStream: TFileStream;
    StartTime: TDateTime;
    
    constructor Create(const APeerID, AFilePath: string; ADirection: TTransferDirection);
    destructor Destroy; override;
    function ProgressPct: Single;
  end;

  TTransferProgressEvent = procedure(Sender: TObject; Transfer: TFileTransfer) of object;
  TTransferCompleteEvent = procedure(Sender: TObject; Transfer: TFileTransfer) of object;
  TTransferErrorEvent = procedure(Sender: TObject; Transfer: TFileTransfer; const ErrorMsg: string) of object;
  TTransferRequestEvent = procedure(Sender: TObject; const PeerID, FileName: string; FileSize: Int64; const TransferID: string) of object;
  
  // Callback to send data via Bridge
  TSendDataCallback = procedure(const RemoteID: string; Payload: TJSONObject) of object;

  TFileTransferManager = class
  private
    FTransfers: TObjectDictionary<string, TFileTransfer>; // Map TransferID -> Transfer
    FChunkSize: Integer;
    FOnProgress: TTransferProgressEvent;
    FOnComplete: TTransferCompleteEvent;
    FOnError: TTransferErrorEvent;
    FOnRequest: TTransferRequestEvent;
    FSendDataCallback: TSendDataCallback;
    
    function GenerateTransferID: string;
  public
    constructor Create;
    destructor Destroy; override;
    
    property OnProgress: TTransferProgressEvent read FOnProgress write FOnProgress;
    property OnComplete: TTransferCompleteEvent read FOnComplete write FOnComplete;
    property OnError: TTransferErrorEvent read FOnError write FOnError;
    property OnRequest: TTransferRequestEvent read FOnRequest write FOnRequest;
    property SendDataCallback: TSendDataCallback read FSendDataCallback write FSendDataCallback;
    
    // Outgoing
    function OfferFile(const PeerID, FilePath: string): string; // Returns TransferID
    procedure AcceptOffer(const PeerID, TransferID, SavePath: string; FileSize: Int64; FileName: string);
    procedure CancelTransfer(const TransferID: string);
    
    // Incoming Protocol Handling
    procedure HandleMessage(const PeerID: string; JSON: TJSONObject);
    
    // Internal Logic
    procedure ProcessNextChunk(Transfer: TFileTransfer);
    function GetActiveTransfers: TList<TFileTransfer>;
  end;

implementation

{ TFileTransfer }

constructor TFileTransfer.Create(const APeerID, AFilePath: string; ADirection: TTransferDirection);
begin
  ID := '';
  PeerID := APeerID;
  FilePath := AFilePath;
  FileName := ExtractFileName(AFilePath);
  Direction := ADirection;
  State := tsPending;
  BytesTransferred := 0;
  StartTime := Now;
  
  if (ADirection = tdOutgoing) and FileExists(AFilePath) then
  begin
    FileStream := TFileStream.Create(AFilePath, fmOpenRead or fmShareDenyWrite);
    FileSize := FileStream.Size;
  end
  else
  begin
    FileStream := nil; // Created on Accept
    FileSize := 0; 
  end;
end;

destructor TFileTransfer.Destroy;
begin
  if Assigned(FileStream) then
    FileStream.Free;
  inherited;
end;

function TFileTransfer.ProgressPct: Single;
begin
  if FileSize = 0 then Result := 0
  else Result := (BytesTransferred / FileSize) * 100;
end;

{ TFileTransferManager }

constructor TFileTransferManager.Create;
begin
  FTransfers := TObjectDictionary<string, TFileTransfer>.Create([doOwnsValues]);
  FChunkSize := 16 * 1024; // 16KB chunks to be safe with WebRTC limits
end;

destructor TFileTransferManager.Destroy;
begin
  FTransfers.Free;
  inherited;
end;

function TFileTransferManager.GenerateTransferID: string;
begin
  Result := TGUID.NewGuid.ToString.Replace('{', '').Replace('}', '');
end;

function TFileTransferManager.OfferFile(const PeerID, FilePath: string): string;
var
  Transfer: TFileTransfer;
  Msg: TJSONObject;
begin
  // 1. Create Transfer Object
  Transfer := TFileTransfer.Create(PeerID, FilePath, tdOutgoing);
  Transfer.ID := GenerateTransferID;
  Result := Transfer.ID;
  
  FTransfers.Add(Transfer.ID, Transfer);
  
  // 2. Send OFFER message
  if Assigned(FSendDataCallback) then
  begin
    Msg := TJSONObject.Create;
    try
      Msg.AddPair('type', 'FILE_OFFER');
      Msg.AddPair('transferId', Transfer.ID);
      Msg.AddPair('fileName', Transfer.FileName);
      Msg.AddPair('fileSize', TJSONNumber.Create(Transfer.FileSize));
      
      FSendDataCallback(PeerID, Msg);
    except
      Msg.Free; // If callback fails, though json is usually managed by SendDataCallback impl? 
      // Ideally implementation of SendDataCallback takes ownership or clones.
      // We will assume implementation clones it.
    end;
  end;
end;

procedure TFileTransferManager.CancelTransfer(const TransferID: string);
begin
  if FTransfers.ContainsKey(TransferID) then
  begin
    // Send CANCEL message if active?
    FTransfers.Remove(TransferID);
  end;
end;

procedure TFileTransferManager.AcceptOffer(const PeerID, TransferID, SavePath: string; FileSize: Int64; FileName: string);
var
  Transfer: TFileTransfer;
  Msg: TJSONObject;
begin
  Transfer := TFileTransfer.Create(PeerID, SavePath, tdIncoming);
  Transfer.ID := TransferID;
  Transfer.FileSize := FileSize;
  Transfer.FileName := FileName;
  
  // Create FileStream for writing
  if not TDirectory.Exists(ExtractFileDir(SavePath)) then
    TDirectory.CreateDirectory(ExtractFileDir(SavePath));
    
  Transfer.FileStream := TFileStream.Create(SavePath, fmCreate);
  Transfer.State := tsTransferring;
  
  FTransfers.Add(Transfer.ID, Transfer);
  
  // Send ACCEPT
  if Assigned(FSendDataCallback) then
  begin
    Msg := TJSONObject.Create;
    Msg.AddPair('type', 'FILE_ACCEPT');
    Msg.AddPair('transferId', Transfer.ID);
    FSendDataCallback(PeerID, Msg);
  end;
end;

procedure TFileTransferManager.HandleMessage(const PeerID: string; JSON: TJSONObject);
var
  MsgType, TransferID: string;
  Transfer: TFileTransfer;
  Buffer: TBytes;
  Msg: TJSONObject;
begin
  if not JSON.TryGetValue<string>('type', MsgType) then Exit;
  if not JSON.TryGetValue<string>('transferId', TransferID) then Exit;
  
  if MsgType = 'FILE_OFFER' then
  begin
     // Keep simple: Fire event, let UI decide to Accept/Reject
     // We should probably create a placeholder Incoming Transfer object here
     if Assigned(FOnRequest) then
       FOnRequest(Self, PeerID, 
                  JSON.GetValue<string>('fileName'), 
                  JSON.GetValue<Int64>('fileSize'), 
                  TransferID);
  end
  else if MsgType = 'FILE_ACCEPT' then
  begin
     if FTransfers.TryGetValue(TransferID, Transfer) then
     begin
       Transfer.State := tsTransferring;
       ProcessNextChunk(Transfer); // Start sending
     end;
  end
  else if MsgType = 'FILE_REJECT' then
  begin
     if FTransfers.ContainsKey(TransferID) then
     begin
       if Assigned(FOnError) then FOnError(Self, FTransfers[TransferID], 'Transfer rejected by peer');
       FTransfers.Remove(TransferID);
     end;
  end
  else if MsgType = 'FILE_DATA' then
  begin
      if FTransfers.TryGetValue(TransferID, Transfer) then
      begin
         try
           Buffer := TNetEncoding.Base64.DecodeStringToBytes(JSON.GetValue<string>('data'));
           Transfer.FileStream.Write(Buffer, Length(Buffer));
           Transfer.BytesTransferred := Transfer.BytesTransferred + Length(Buffer);
           
           // Send ACK
           if Assigned(FSendDataCallback) then
           begin
             Msg := TJSONObject.Create;
             Msg.AddPair('type', 'FILE_ACK');
             Msg.AddPair('transferId', TransferID);
             FSendDataCallback(PeerID, Msg);
           end;
           
           if Assigned(FOnProgress) then FOnProgress(Self, Transfer);
           
           if Transfer.BytesTransferred >= Transfer.FileSize then
           begin
              Transfer.State := tsCompleted;
              if Assigned(FOnComplete) then FOnComplete(Self, Transfer);
              FTransfers.Remove(TransferID); // Clean up
           end;
         except
           on E: Exception do
           begin
             if Assigned(FOnError) then FOnError(Self, Transfer, E.Message);
             FTransfers.Remove(TransferID);
           end;
         end;
      end;
  end
  else if MsgType = 'FILE_ACK' then
  begin
      // Flow control / Next chunk
      if FTransfers.TryGetValue(TransferID, Transfer) then
        ProcessNextChunk(Transfer);
  end;
end;

procedure TFileTransferManager.ProcessNextChunk(Transfer: TFileTransfer);
var
  Buffer: TBytes;
  BytesRead: Integer;
  Base64: string;
  Msg: TJSONObject;
begin
  if Transfer.State <> tsTransferring then Exit;
  
  SetLength(Buffer, FChunkSize);
  BytesRead := Transfer.FileStream.Read(Buffer, FChunkSize);
  
  if BytesRead > 0 then
  begin
     SetLength(Buffer, BytesRead);
     Base64 := TNetEncoding.Base64.EncodeBytesToString(Buffer);
     
     Transfer.BytesTransferred := Transfer.BytesTransferred + BytesRead;
     
     if Assigned(FSendDataCallback) then
     begin
       Msg := TJSONObject.Create;
       Msg.AddPair('type', 'FILE_DATA');
       Msg.AddPair('transferId', Transfer.ID);
       Msg.AddPair('data', Base64);
       
       // If last chunk, maybe flag it? Or handled by size?
       // Usually Base64 adds 33% overhead. 16KB -> ~21KB. Safe for WebRTC (limit is often 64KB-256KB).
       
       FSendDataCallback(Transfer.PeerID, Msg);
     end;
     
     if Assigned(FOnProgress) then FOnProgress(Self, Transfer);
     
     // Primitive flow control: Wait for ACK before next? 
     // For now, let's assume we need ACK or just pump it (but UI loop might freeze)
     // Better to use ACK for flow control.
  end
  else
  begin
     Transfer.State := tsCompleted;
     if Assigned(FOnComplete) then FOnComplete(Self, Transfer);
     
     // Send EOF or COMPLETE message?
     // Or peer detects by size.
  end;
end;

function TFileTransferManager.GetActiveTransfers: TList<TFileTransfer>;
var
  Pair: TPair<string, TFileTransfer>;
begin
  Result := TList<TFileTransfer>.Create;
  for Pair in FTransfers do
    Result.Add(Pair.Value);
end;

end.
