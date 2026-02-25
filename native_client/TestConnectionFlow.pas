unit TestConnectionFlow;

interface

uses
  DUnitX.TestFramework, System.SysUtils, System.JSON, Classes;

type
  // Mock Bridge to capture sent data
  TMockBridge = class
  public
    LastSentType: string;
    LastSentData: TJSONObject;
    procedure SendDataJSON(const RemoteID: string; Data: TJSONObject);
  end;

  // Mock FormMain to isolate logic
  TMockFormMain = class
  public
    FBridge: TMockBridge;
    FIncomingPeerID: string;
    FLastPassword: string;
    
    constructor Create;
    destructor Destroy; override;
    
    // The method under test
    procedure OnConnOpen(Sender: TObject; const RemoteID: string);
    procedure Log(const Msg: string);
  end;

  [TestFixture]
  TTestConnectionFlow = class
  private
    FForm: TMockFormMain;
  public
    [Setup]
    procedure SetUp;
    [TearDown]
    procedure TearDown;
    
    [Test]
    procedure TestViewerSendsAuth;
    [Test]
    procedure TestHostWaitsForAuth;
  end;

implementation

{ TMockBridge }

procedure TMockBridge.SendDataJSON(const RemoteID: string; Data: TJSONObject);
begin
  if Data.TryGetValue('type', LastSentType) then
  begin
    if LastSentData <> nil then LastSentData.Free;
    LastSentData := Data.Clone as TJSONObject;
  end;
  Data.Free; // Simulate ownership transfer or cleanup
end;

{ TMockFormMain }

constructor TMockFormMain.Create;
begin
  FBridge := TMockBridge.Create;
  FLastPassword := 'secret123';
end;

destructor TMockFormMain.Destroy;
begin
  FBridge.Free;
  inherited;
end;

procedure TMockFormMain.Log(const Msg: string);
begin
  // No-op for test
end;

// Copied Logic from MainForm.pas (Simulated)
procedure TMockFormMain.OnConnOpen(Sender: TObject; const RemoteID: string);
var
  LAuth: TJSONObject;
begin
  // If this is the peer we just accepted an incoming connection from,
  // WE are the Host, so WE wait for authentication. Do NOT send AUTH.
  if (FIncomingPeerID <> '') and (RemoteID = FIncomingPeerID) then
  begin
    Exit;
  end;

  // Otherwise, WE are the Viewer connecting to a remote host.
  LAuth := TJSONObject.Create;
  LAuth.AddPair('type', 'AUTH');
  LAuth.AddPair('password', FLastPassword);
  FBridge.SendDataJSON(RemoteID, LAuth);
end;

{ TTestConnectionFlow }

procedure TTestConnectionFlow.SetUp;
begin
  FForm := TMockFormMain.Create;
end;

procedure TTestConnectionFlow.TearDown;
begin
  FForm.Free;
end;

procedure TTestConnectionFlow.TestViewerSendsAuth;
begin
  // Setup: We are connecting to a remote peer (Viewer Mode)
  FForm.FIncomingPeerID := ''; // No incoming connection
  
  // Act
  FForm.OnConnOpen(nil, 'RemoteHostID');
  
  // Assert
  Assert.AreEqual('AUTH', FForm.FBridge.LastSentType, 'Viewer should send AUTH packet');
  
  // Data check
  if FForm.FBridge.LastSentData <> nil then
     Assert.AreEqual('secret123', FForm.FBridge.LastSentData.GetValue<string>('password'), 'Password should match')
  else
     Assert.Fail('No data packet captured');
end;

procedure TTestConnectionFlow.TestHostWaitsForAuth;
begin
  // Setup: We accepted an incoming connection from this peer (Host Mode)
  FForm.FIncomingPeerID := 'ViewerClient1';
  
  // Act
  FForm.OnConnOpen(nil, 'ViewerClient1');
  
  // Assert
  Assert.AreEqual('', FForm.FBridge.LastSentType, 'Host should NOT send AUTH packet immediately');
end;

initialization
  TDUnitX.RegisterTestFixture(TTestConnectionFlow);

end.
