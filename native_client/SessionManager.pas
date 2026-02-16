unit SessionManager;

interface

uses
  System.SysUtils, System.Classes, System.Generics.Collections, StorageUtils;

type
  TSessionChangeType = (scAdded, scRemoved, scTabSwitched, scOnlineStatusChanged, 
    scPasswordChanged, scContactUpdated, scStorageChanged);

  TSessionChangeEvent = procedure(Sender: TObject; ChangeType: TSessionChangeType; const SessionID: string) of object;

  TMireSessionManager = class
  private
    FStorage: TMireStorage;
    FActiveSessions: TList<string>;
    FActiveTabID: string; // 'dashboard' or RemoteID
    FActiveSubTab: string; // 'recent' or 'favorites'
    FOnSessionChange: TSessionChangeEvent;
    
    procedure SetActiveTabID(const Value: string);
    procedure SetActiveSubTab(const Value: string);
  protected
    procedure DoSessionChange(ChangeType: TSessionChangeType; const SessionID: string);
  public
    constructor Create;
    destructor Destroy; override;
    
    procedure Load;
    procedure Save;
    
    procedure AddSession(const RemoteID: string);
    procedure RemoveSession(const RemoteID: string);
    function IsSessionActive(const RemoteID: string): Boolean;
    
    // New methods for granular notifications
    procedure NotifyPasswordChanged;
    procedure NotifyContactUpdated(const ContactID: string);
    procedure NotifyStorageChanged;
    
    property Storage: TMireStorage read FStorage;
    property ActiveSessions: TList<string> read FActiveSessions;
    property ActiveTabID: string read FActiveTabID write SetActiveTabID;
    property ActiveSubTab: string read FActiveSubTab write SetActiveSubTab;
    property OnSessionChange: TSessionChangeEvent read FOnSessionChange write FOnSessionChange;
    
    function IsDashboard: Boolean;
  end;

implementation

{ TMireSessionManager }

constructor TMireSessionManager.Create;
begin
  FStorage := TMireStorage.Create;
  FActiveSessions := TList<string>.Create;
  FActiveTabID := 'dashboard';
  FActiveSubTab := 'recent';
end;

destructor TMireSessionManager.Destroy;
begin
  FActiveSessions.Free;
  FStorage.Free;
  inherited;
end;

procedure TMireSessionManager.DoSessionChange(ChangeType: TSessionChangeType; const SessionID: string);
begin
  if Assigned(FOnSessionChange) then
    FOnSessionChange(Self, ChangeType, SessionID);
end;

procedure TMireSessionManager.Load;
begin
  FStorage.Load;
end;

procedure TMireSessionManager.Save;
begin
  FStorage.Save;
end;

procedure TMireSessionManager.AddSession(const RemoteID: string);
begin
  if not FActiveSessions.Contains(RemoteID) then
  begin
    FActiveSessions.Add(RemoteID);
    DoSessionChange(scAdded, RemoteID);
  end;
end;

procedure TMireSessionManager.RemoveSession(const RemoteID: string);
begin
  if FActiveSessions.Contains(RemoteID) then
  begin
    FActiveSessions.Remove(RemoteID);
    if FActiveTabID = RemoteID then
      ActiveTabID := 'dashboard';
    DoSessionChange(scRemoved, RemoteID);
  end;
end;

function TMireSessionManager.IsSessionActive(const RemoteID: string): Boolean;
begin
  Result := FActiveSessions.Contains(RemoteID);
end;

function TMireSessionManager.IsDashboard: Boolean;
begin
  Result := FActiveTabID = 'dashboard';
end;

procedure TMireSessionManager.SetActiveSubTab(const Value: string);
begin
  if FActiveSubTab <> Value then
  begin
    FActiveSubTab := Value;
    DoSessionChange(scTabSwitched, 'dashboard');
  end;
end;

procedure TMireSessionManager.SetActiveTabID(const Value: string);
begin
  if FActiveTabID <> Value then
  begin
    FActiveTabID := Value;
    DoSessionChange(scTabSwitched, Value);
  end;
end;

procedure TMireSessionManager.NotifyPasswordChanged;
begin
  DoSessionChange(scPasswordChanged, '');
end;

procedure TMireSessionManager.NotifyContactUpdated(const ContactID: string);
begin
  DoSessionChange(scContactUpdated, ContactID);
end;

procedure TMireSessionManager.NotifyStorageChanged;
begin
  DoSessionChange(scStorageChanged, '');
end;

end.
