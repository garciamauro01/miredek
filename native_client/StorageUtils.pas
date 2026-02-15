unit StorageUtils;

interface

uses
  System.SysUtils, System.Classes, System.JSON, System.Generics.Collections, 
  System.IOUtils, System.NetEncoding;

type
  TContact = class
  public
    ID: string;
    Alias: string;
    IsFavorite: Boolean;
    Thumbnail: string;
    LastConnected: Int64;
    SavedPassword: string; // Encrypted password
    constructor Create(const AID, AAlias: string);
  end;

  TMireStorage = class
  private
    FContacts: TObjectList<TContact>;
    FRecentSessions: TStringList;
    FStoragePath: string;
    function GetConfigPath: string;
  public
    constructor Create;
    destructor Destroy; override;
    procedure Load;
    procedure Save;
    procedure AddRecent(const ID: string);
    procedure UpdateContact(const ID, Alias: string; IsFavorite: Boolean);
    procedure SavePassword(const ID, Password: string);
    function GetSavedPassword(const ID: string): string;
    property Contacts: TObjectList<TContact> read FContacts;
    property RecentSessions: TStringList read FRecentSessions;
  end;

implementation

{ TContact }

constructor TContact.Create(const AID, AAlias: string);
begin
  ID := AID;
  Alias := AAlias;
  IsFavorite := False;
  Thumbnail := '';
  LastConnected := 0;
  SavedPassword := '';
end;

{ TMireStorage }

constructor TMireStorage.Create;
begin
  FContacts := TObjectList<TContact>.Create(True);
  FRecentSessions := TStringList.Create;
  FRecentSessions.CaseSensitive := False;
  FRecentSessions.Duplicates := dupIgnore;
  FRecentSessions.Sorted := False;
end;

destructor TMireStorage.Destroy;
begin
  FContacts.Free;
  FRecentSessions.Free;
  inherited;
end;

function TMireStorage.GetConfigPath: string;
begin
  Result := TPath.Combine(TPath.GetHomePath, 'MireDesk');
  if not TDirectory.Exists(Result) then
    TDirectory.CreateDirectory(Result);
end;

procedure TMireStorage.Load;
var
  LFilePath: string;
  LContent: string;
  LJSON, LItem: TJSONValue;
  LArr: TJSONArray;
  LContact: TContact;
  I: Integer;
begin
  LFilePath := TPath.Combine(GetConfigPath, 'storage.json');
  if not TFile.Exists(LFilePath) then Exit;

  LContent := TFile.ReadAllText(LFilePath);
  if LContent.Trim = '' then Exit;
  
  try
    LJSON := TJSONObject.ParseJSONValue(LContent);
    if not Assigned(LJSON) or not (LJSON is TJSONObject) then Exit;
  except
    Exit;
  end;

  try
    // Load Recent Sessions
    if TJSONObject(LJSON).TryGetValue('recent_sessions', LArr) then
    begin
      FRecentSessions.Clear;
      for I := 0 to LArr.Count - 1 do
        FRecentSessions.Add(LArr.Items[I].Value);
    end;

    // Load Contacts
    if TJSONObject(LJSON).TryGetValue('contacts', LArr) then
    begin
      FContacts.Clear;
      for LItem in LArr do
      begin
        LContact := TContact.Create(
          LItem.GetValue<string>('id'),
          LItem.GetValue<string>('alias')
        );
        LContact.IsFavorite := LItem.GetValue<Boolean>('isFavorite');
        LContact.Thumbnail := LItem.GetValue<string>('thumbnail');
        LContact.LastConnected := LItem.GetValue<Int64>('lastConnected');
        if LItem.TryGetValue<string>('savedPassword', LContact.SavedPassword) then
          {Password loaded}
        else
          LContact.SavedPassword := '';
        FContacts.Add(LContact);
      end;
    end;
  finally
    if Assigned(LJSON) then
      LJSON.Free;
  end;
end;

procedure TMireStorage.Save;
var
  LJSON: TJSONObject;
  LContactsArr, LRecentArr: TJSONArray;
  LContact: TContact;
  LItem: TJSONObject;
  LID: string;
begin
  LJSON := TJSONObject.Create;
  LContactsArr := TJSONArray.Create;
  LRecentArr := TJSONArray.Create;

  for LContact in FContacts do
  begin
    LItem := TJSONObject.Create;
    LItem.AddPair('id', LContact.ID);
    LItem.AddPair('alias', LContact.Alias);
    LItem.AddPair('isFavorite', LContact.IsFavorite);
    LItem.AddPair('thumbnail', LContact.Thumbnail);
    LItem.AddPair('lastConnected', TJSONNumber.Create(LContact.LastConnected));
    if LContact.SavedPassword <> '' then
      LItem.AddPair('savedPassword', LContact.SavedPassword);
    LContactsArr.AddElement(LItem);
  end;

  for LID in FRecentSessions do
    LRecentArr.Add(LID);

  LJSON.AddPair('contacts', LContactsArr);
  LJSON.AddPair('recent_sessions', LRecentArr);

  TFile.WriteAllText(TPath.Combine(GetConfigPath, 'storage.json'), LJSON.ToJSON);
  LJSON.Free;
end;

procedure TMireStorage.AddRecent(const ID: string);
var
  Idx: Integer;
begin
  Idx := FRecentSessions.IndexOf(ID);
  if Idx <> -1 then
    FRecentSessions.Delete(Idx);
    
  FRecentSessions.Insert(0, ID);
  // Limit to last 20
  while FRecentSessions.Count > 20 do
    FRecentSessions.Delete(FRecentSessions.Count - 1);
end;

procedure TMireStorage.UpdateContact(const ID, Alias: string; IsFavorite: Boolean);
var
  LContact: TContact;
  LFound: Boolean;
begin
  LFound := False;
  for LContact in FContacts do
  begin
    if LContact.ID = ID then
    begin
      LContact.Alias := Alias;
      LContact.IsFavorite := IsFavorite;
      LFound := True;
      Break;
    end;
  end;

  if not LFound then
  begin
    LContact := TContact.Create(ID, Alias);
    LContact.IsFavorite := IsFavorite;
    FContacts.Add(LContact);
  end;
end;

procedure TMireStorage.SavePassword(const ID, Password: string);
var
  LContact: TContact;
  LFound: Boolean;
begin
  LFound := False;
  for LContact in FContacts do
  begin
    if LContact.ID = ID then
    begin
      // Simple encoding (Base64) - in production use proper encryption
      LContact.SavedPassword := TNetEncoding.Base64.Encode(Password);
      LFound := True;
      Break;
    end;
  end;

  if not LFound then
  begin
    LContact := TContact.Create(ID, '');
    LContact.SavedPassword := TNetEncoding.Base64.Encode(Password);
    FContacts.Add(LContact);
  end;
end;

function TMireStorage.GetSavedPassword(const ID: string): string;
var
  LContact: TContact;
begin
  Result := '';
  for LContact in FContacts do
  begin
    if LContact.ID = ID then
    begin
      if LContact.SavedPassword <> '' then
        Result := TNetEncoding.Base64.Decode(LContact.SavedPassword);
      Break;
    end;
  end;
end;

end.
