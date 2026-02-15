unit MainForm;

interface

uses
  Winapi.Windows, Winapi.Messages, System.SysUtils, System.Variants, System.Classes, Vcl.Graphics,
  Vcl.Controls, Vcl.Forms, Vcl.Dialogs, Vcl.Edge, Vcl.StdCtrls, Vcl.ExtCtrls,
  PeerJSBridge, InputUtils, Styles, UIParts, ServiceUtils, StorageUtils, Icons, PasswordDialog,
  System.JSON, System.Skia, Vcl.Skia, Vcl.Clipbrd, System.Types, System.UITypes,
  Winapi.WebView2, Winapi.ActiveX, System.IOUtils, System.Math, System.Generics.Collections, Vcl.Menus, System.IniFiles;

  type
  TUIElement = (uiNone, uiConnectBtn, uiSessionCard, uiTab, uiTabClose, uiSidebarBtn, uiSidebarCopyID, uiSearchBar, uiSidebarRegenPass, uiActiveBannerBtn, uiChatBtn, uiMonitorBtn, uiActionsBtn, uiViewModeBtn, uiSidebarSettings, uiSettingsSaveBtn, uiSettingsCancelBtn, uiSettingsIPArea);

  TFormMain = class(TForm)
    EdgeBrowser: TEdgeBrowser;
    PanelSidebar: TPanel;
    btnConnect: TButton;
    editRemoteID: TEdit;
    memoLog: TMemo;
    lblMyID: TLabel;
    TimerPulse: TTimer;
    SkPaintBoxMain: TSkPaintBox;
    procedure FormCreate(Sender: TObject);
    procedure EdgeBrowserCreateWebViewCompleted(Sender: TCustomEdgeBrowser;
      AResult: HRESULT);
    procedure TimerPulseTimer(Sender: TObject);
    procedure FormMouseDown(Sender: TObject; Button: TMouseButton;
      Shift: TShiftState; X, Y: Integer);
    procedure SkPaintBoxMainDraw(ASender: TObject; const ACanvas: ISkCanvas;
      const ADest: TRectF; const AOpacity: Single);
    procedure FormResize(Sender: TObject);
    procedure FormMouseWheel(Sender: TObject; Shift: TShiftState;
      WheelDelta: Integer; MousePos: TPoint; var Handled: Boolean);
    procedure FormKeyDown(Sender: TObject; var Key: Word; Shift: TShiftState);
    procedure FormClose(Sender: TObject; var Action: TCloseAction);
  private
    FBridge: TMirePeerBridge;
    FPeerID: string;
    FPulseScale: Single;
    FIsConnected: Boolean;
    FIncomingPeerID: string;
    FShowAcceptanceModal: Boolean;
    FSessionPassword: string;
    FLastClipboardText: string;
    FServerConnected: Boolean;
    TimerClipboard: TTimer;
    FStorage: TMireStorage;
    FActiveTab: string; // 'recent', 'favorites' (Dashboard internal)
    FActiveTabID: string; // 'dashboard' or session ID
    FActiveSessions: TStringList; // List of remote IDs with active sessions
    FLastPassword: string;
    FCurrentRemoteID: string;
    FScrollOffset: Single;
    FMaxScroll: Single;
    FPopupMenu: TPopupMenu;
    FTargetSessionID: string;
    
    // Hover State
    FHoveredElement: TUIElement;
    FHoveredID: string; // For sessions/tabs
    FHoveredIndex: Integer;
    FSearchTerm: string;
    FAppVersion: string;
    FIsChatOpen: Boolean;
    FShowSettingsModal: Boolean;
    FServerIP: string;
    
    FOnlineMap: TDictionary<string, Boolean>;
    FStatusTick: Integer;
    
    FTrayIcon: TTrayIcon;
    FTrayMenu: TPopupMenu;
    FAppLogo: ISkImage;
    FAppSplash: ISkSVGDOM;

    procedure OnTrayDblClick(Sender: TObject);
    procedure OnTrayShow(Sender: TObject);
    procedure OnTrayExit(Sender: TObject);

    procedure OnPeerOnlineStatus(Sender: TObject; const RemoteID: string; IsOnline: Boolean);
    procedure OnMenuRename(Sender: TObject);
    procedure OnMenuFavorite(Sender: TObject);
    procedure OnMenuDelete(Sender: TObject);

    function GetPersistentID: string;
    procedure LoadConfig;
    procedure SaveConfig;
    procedure SendSourcesList(const RemoteID: string);
    procedure SetupModernUI;
    procedure OnBridgeReady(Sender: TObject);
    procedure OnPeerOpen(Sender: TObject; const PeerID: string);
    procedure OnPeerConnection(Sender: TObject; const RemoteID: string);
    procedure OnConnOpen(Sender: TObject; const RemoteID: string);
    procedure OnConnClose(Sender: TObject; const RemoteID: string);
    procedure OnVideoStarted(Sender: TObject; const RemoteID: string);
    procedure OnDataReceived(Sender: TObject; const RemoteID: string; Data: TJSONValue);

    procedure OnPeerError(Sender: TObject; const ErrorMsg: string);
    procedure OnLog(Sender: TObject; const Msg: string);
    procedure TimerClipboardTimer(Sender: TObject);
    procedure editRemoteIDKeyPress(Sender: TObject; var Key: Char);
    procedure editRemoteIDEnter(Sender: TObject);
    procedure SkPaintBoxMainMouseMove(Sender: TObject; Shift: TShiftState; X, Y: Integer);
    procedure SkPaintBoxMainMouseLeave(Sender: TObject);
  public
    { Public declarations }
    { Public declarations }
    destructor Destroy; override;
  end;

var
  FormMain: TFormMain;

implementation

{$R *.dfm}

function AlphaToVcl(AColor: TAlphaColor): TColor;
begin
  Result := RGB(TAlphaColorRec(AColor).R, TAlphaColorRec(AColor).G, TAlphaColorRec(AColor).B);
end;







procedure TFormMain.FormCreate(Sender: TObject);
var
  BridgeHTML: string;
  LItem: TMenuItem;
begin
  // Standard VCL Double Buffering to avoid flicker
  Self.DoubleBuffered := True;
  
  FOnlineMap := TDictionary<string, Boolean>.Create;
  FStatusTick := 0;

  
  // Fix WebView2 initialization: Use a guaranteed writeable TEMP folder for user data
  // Using C:\ root often fails due to permissions (0x80004005)
  EdgeBrowser.UserDataFolder := TPath.Combine(TPath.GetTempPath, 'MireDeskWebView2'); 
  if not TDirectory.Exists(EdgeBrowser.UserDataFolder) then
    try
      TDirectory.CreateDirectory(EdgeBrowser.UserDataFolder);
    except
      memoLog.Lines.Add('Warning: Could not create UserDataFolder at ' + EdgeBrowser.UserDataFolder);
    end;

  memoLog.Lines.Add('Attempting WebView2 Initialization...');
  memoLog.Lines.Add('DLL Found in App Folder: ' + BoolToStr(FileExists(ExtractFilePath(ParamStr(0)) + 'WebView2Loader.dll'), True));
  memoLog.Lines.Add('User Data Path: ' + EdgeBrowser.UserDataFolder);

  SetupModernUI;
  // Hide legacy VCL UI components to let Skia take over
  PanelSidebar.Align := alNone;
  PanelSidebar.Visible := False;
  PanelSidebar.Left := -1000;
  
  // Show memoLog at the bottom for debugging
  memoLog.Parent := Self;
  memoLog.Visible := True;
  memoLog.Align := alBottom;
  memoLog.Height := 120;
  memoLog.BringToFront;
  
  EdgeBrowser.Visible := True; // MUST be visible for captureStream/requestAnimationFrame to work
  EdgeBrowser.SetBounds(-2000, 0, 800, 600); // Position far off-screen
  
  lblMyID.Visible := False;
  editRemoteID.Visible := True;
  
  FPulseScale := 0;
  FLastPassword := '123456';
  FIsConnected := False;
  FServerConnected := False;
  FShowAcceptanceModal := False;
  FLastClipboardText := '';
  FActiveTab := 'recent';
  
  try
    FStorage := TMireStorage.Create;
    FStorage.Load;
  except
    on E: Exception do
      memoLog.Lines.Add('Warning: Could not load storage: ' + E.Message);
  end;
  
  FAppVersion := '1.0.8'; // Match Electron or detect automatically if possible
  FSearchTerm := '';
  FIsChatOpen := False;
  FShowSettingsModal := False;
  FServerIP := 'cloud'; // Default
  
  FActiveSessions := TStringList.Create;
  FActiveSessions.CaseSensitive := False;
  FActiveSessions.Duplicates := dupIgnore;
  FActiveTabID := 'dashboard';
  FScrollOffset := 0;
  FMaxScroll := 0;
  Self.OnMouseWheel := FormMouseWheel;
  TimerClipboard := TTimer.Create(Self);
  TimerClipboard.Interval := 1500;
  TimerClipboard.OnTimer := TimerClipboardTimer;
  TimerClipboard.Enabled := True;

  // Optimize Skia caching
  SkPaintBoxMain.DrawCacheKind := TSkDrawCacheKind.Raster;

  // Setup Tray Icon
  FTrayIcon := TTrayIcon.Create(Self);
  FTrayIcon.Icon := Application.Icon;
  FTrayIcon.OnDblClick := OnTrayDblClick;
  FTrayIcon.Visible := True;
  FTrayIcon.Hint := 'Miré-Desk';

  FTrayMenu := TPopupMenu.Create(Self);
  LItem := TMenuItem.Create(FTrayMenu);
  LItem.Caption := 'Abrir Miré-Desk';
  LItem.OnClick := OnTrayShow;
  FTrayMenu.Items.Add(LItem);

  LItem := TMenuItem.Create(FTrayMenu);
  LItem.Caption := '-';
  FTrayMenu.Items.Add(LItem);

  LItem := TMenuItem.Create(FTrayMenu);
  LItem.Caption := 'Sair';
  LItem.OnClick := OnTrayExit;
  FTrayMenu.Items.Add(LItem);

  FTrayIcon.PopupMenu := FTrayMenu;

  // Initially hide to taskbar if requested
  Application.ShowMainForm := False;
  Self.Hide;

  // Load App Logo from Resource
  var LResStream := TResourceStream.Create(HInstance, 'LOGO_MIREDESK', RT_RCDATA);
  try
    var LBytes: TBytes;
    SetLength(LBytes, LResStream.Size);
    LResStream.ReadBuffer(LBytes[0], LResStream.Size);
    FAppLogo := TSkImage.MakeFromEncoded(LBytes);

    // Load App Splash (SVG)
    var LSplashStream := TResourceStream.Create(HInstance, 'SPLASH_MIREDESK', RT_RCDATA);
    try
      var LSVGReader := TStringStream.Create('', TEncoding.UTF8);
      try
        LSVGReader.CopyFrom(LSplashStream, LSplashStream.Size);
        FAppSplash := TSkSVGDOM.Make(LSVGReader.DataString);
      finally
        LSVGReader.Free;
      end;
    finally
      LSplashStream.Free;
    end;
  finally
    LResStream.Free;
  end;
  
  LoadConfig;
  
  FBridge := TMirePeerBridge.Create(EdgeBrowser);
  FBridge.OnBridgeReady := OnBridgeReady;
  FBridge.OnPeerOpen := OnPeerOpen;
  FBridge.OnPeerConnection := OnPeerConnection;
  FBridge.OnConnOpen := OnConnOpen;
  FBridge.OnConnClose := OnConnClose;
  FBridge.OnVideoStarted := OnVideoStarted;
  FBridge.OnDataReceived := OnDataReceived;
  FBridge.OnError := OnPeerError;
  FBridge.OnLog := OnLog;
  FBridge.OnOnlineStatus := OnPeerOnlineStatus;
  
  editRemoteID.OnKeyPress := editRemoteIDKeyPress;
  editRemoteID.OnEnter := editRemoteIDEnter;
  SkPaintBoxMain.OnMouseMove := SkPaintBoxMainMouseMove;
  SkPaintBoxMain.OnMouseLeave := SkPaintBoxMainMouseLeave;
  
  { Load the bridge HTML }
  BridgeHTML := ExtractFilePath(ParamStr(0)) + 'bridge.html';
  if FileExists(BridgeHTML) then
    EdgeBrowser.Navigate('file://' + BridgeHTML)
  else
    memoLog.Lines.Add('Error: bridge.html not found');

  // Manual initialization call (Navigate will also trigger it)
  // EdgeBrowser.CreateWebView; // Navigate usually handles this, let's see if one call is enough
  Self.OnResize := FormResize;
  Self.OnKeyDown := FormKeyDown;
  Self.KeyPreview := True;

  // Setup Popup Menu
  FPopupMenu := TPopupMenu.Create(Self);
  
  LItem := TMenuItem.Create(FPopupMenu);
  LItem.Caption := 'Renomear';
  LItem.OnClick := OnMenuRename;
  FPopupMenu.Items.Add(LItem);
  
  LItem := TMenuItem.Create(FPopupMenu);
  LItem.Caption := 'Favoritar/Desfavoritar';
  LItem.OnClick := OnMenuFavorite;
  FPopupMenu.Items.Add(LItem);
  
  LItem := TMenuItem.Create(FPopupMenu);
  LItem.Caption := 'Remover dos Recentes';
  LItem.OnClick := OnMenuDelete;
  FPopupMenu.Items.Add(LItem);

  FormResize(nil);
end;

procedure TFormMain.OnTrayDblClick(Sender: TObject);
begin
  OnTrayShow(Sender);
end;

procedure TFormMain.OnTrayShow(Sender: TObject);
begin
  Self.Show;
  Application.Restore;
  Application.BringToFront;
end;

procedure TFormMain.OnTrayExit(Sender: TObject);
begin
  Application.Terminate;
end;

destructor TFormMain.Destroy;
begin
  if Assigned(FOnlineMap) then
    FOnlineMap.Free;
  if Assigned(FBridge) then
    FBridge.Free;
  if Assigned(FStorage) then
    FStorage.Save;
  FreeAndNil(FStorage);
  FActiveSessions.Free;
  inherited;
end;


procedure TFormMain.LoadConfig;
var
  Ini: TIniFile;
  IniPath: string;
begin
  IniPath := TPath.Combine(TPath.GetHomePath, 'MireDesk\config.ini');
  Ini := TIniFile.Create(IniPath);
  try
    FServerIP := Ini.ReadString('Network', 'ServerIP', 'cloud');
    FSessionPassword := Ini.ReadString('Security', 'SessionPassword', IntToStr(100000 + Random(899999)));
  finally
    Ini.Free;
  end;
  
  FPeerID := GetPersistentID;
end;

procedure TFormMain.SaveConfig;
var
  Ini: TIniFile;
  IniPath: string;
begin
  IniPath := TPath.Combine(TPath.GetHomePath, 'MireDesk\config.ini');
  Ini := TIniFile.Create(IniPath);
  try
    Ini.WriteString('Network', 'ServerIP', FServerIP);
    Ini.WriteString('Security', 'SessionPassword', FSessionPassword);
  finally
    Ini.Free;
  end;
end;

function TFormMain.GetPersistentID: string;
var
  IDPath: string;
  SL: TStringList;
begin
  IDPath := TPath.Combine(TPath.GetHomePath, 'MireDesk\peer-id.txt');
  if not TDirectory.Exists(TPath.GetDirectoryName(IDPath)) then
    TDirectory.CreateDirectory(TPath.GetDirectoryName(IDPath));

  if FileExists(IDPath) then
  begin
    SL := TStringList.Create;
    try
      SL.LoadFromFile(IDPath);
      Result := SL.Text.Trim;
      if (Result.Length = 9) then Exit;
    finally
      SL.Free;
    end;
  end;

  // Generate new 9-digit ID
  Result := IntToStr(100000000 + Random(900000000));
  SL := TStringList.Create;
  try
    SL.Text := Result;
    SL.SaveToFile(IDPath);
  finally
    SL.Free;
  end;
end;

procedure TFormMain.SendSourcesList(const RemoteID: string);
var
  SourcesArray: TJSONArray;
  SourceObj: TJSONObject;
  I: Integer;
begin
  SourcesArray := TJSONArray.Create;
  for I := 0 to Screen.MonitorCount - 1 do
  begin
    SourceObj := TJSONObject.Create;
    SourceObj.AddPair('id', 'screen:' + IntToStr(I));
    SourceObj.AddPair('name', 'Screen ' + IntToStr(I + 1));
    SourceObj.AddPair('isPrimary', TJSONBool.Create(Screen.Monitors[I].Primary));
    
    // Bounds as expected by Electron UI
    SourceObj.AddPair('bounds', TJSONObject.Create
      .AddPair('x', TJSONNumber.Create(Screen.Monitors[I].Left))
      .AddPair('y', TJSONNumber.Create(Screen.Monitors[I].Top))
      .AddPair('width', TJSONNumber.Create(Screen.Monitors[I].Width))
      .AddPair('height', TJSONNumber.Create(Screen.Monitors[I].Height))
    );
    
    SourcesArray.AddElement(SourceObj);
  end;

  FBridge.SendToWeb('SEND', TJSONObject.Create
    .AddPair('type', 'SOURCES_LIST')
    .AddPair('sources', SourcesArray)
    .AddPair('activeSourceId', 'screen:0')
    .AddPair('remoteId', RemoteID)
  );
end;


procedure TFormMain.SetupModernUI;
begin
  // Set form properties for a clean look
  Caption := 'MireDesk Native';
  Color := AlphaToVcl(skBackground);
  Font.Name := 'Segoe UI';
  Font.Size := 10;
  
  // Hide legacy VCL sidebar items
  // Stylize editRemoteID to blend with Skia
  editRemoteID.Parent := Self;
  editRemoteID.BorderStyle := bsNone;
  editRemoteID.Font.Size := 14; // Slightly larger font
  editRemoteID.Color := AlphaToVcl(skCardBG);
  editRemoteID.TextHint := 'Insira o ID...';
  editRemoteID.Visible := True;
  editRemoteID.BringToFront;
  
  memoLog.Visible := False; // Use internal log or show when needed
end;

procedure TFormMain.FormResize(Sender: TObject);
begin

  // Align Edit comfortably over the Skia input box rect
  // skSidebarWidth (260) + DrawConnectionArea.Left (20) + InputCard.Left (20) = 300
  // Adding 10px padding for the cursor/text inside the card
  editRemoteID.SetBounds(Trunc(skSidebarWidth) + 50, 108, 280, 24);
  editRemoteID.BringToFront;
  
  // WebView sits below the top bar (40px)
  if FActiveTabID <> 'dashboard' then
  begin
    EdgeBrowser.SetBounds(0, 40, Self.ClientWidth, Self.ClientHeight - 40 - memoLog.Height);
    EdgeBrowser.Visible := True;
    EdgeBrowser.BringToFront;
  end
  else
  begin
    EdgeBrowser.SetBounds(-2000, 0, 800, 600); // Off-screen
    EdgeBrowser.Visible := False;
  end;
end;

procedure TFormMain.FormMouseWheel(Sender: TObject; Shift: TShiftState;
  WheelDelta: Integer; MousePos: TPoint; var Handled: Boolean);
begin
  if FActiveTabID = 'dashboard' then
  begin
    FScrollOffset := FScrollOffset - (WheelDelta / 2); // Adjust speed
    if FScrollOffset < 0 then FScrollOffset := 0;
    if FScrollOffset > FMaxScroll then FScrollOffset := FMaxScroll;
    
    SkPaintBoxMain.Redraw;
    Handled := True;
  end;
end;

procedure TFormMain.editRemoteIDEnter(Sender: TObject);
begin
  editRemoteID.SelectAll;
end;

procedure TFormMain.editRemoteIDKeyPress(Sender: TObject; var Key: Char);
begin
  if Key = #13 then // ENTER
  begin
    Key := #0; // Prevent beep
    if editRemoteID.Text <> '' then
    begin
       FCurrentRemoteID := Trim(editRemoteID.Text);
       if FActiveSessions.IndexOf(FCurrentRemoteID) <> -1 then
       begin
          FActiveTabID := FCurrentRemoteID;
          FormResize(nil);
          SkPaintBoxMain.Redraw;
       end
       else
       begin
         // Check for saved password first
         var RemotePassword: string := FStorage.GetSavedPassword(FCurrentRemoteID);
         var RememberPassword: Boolean := False;
         
         // If no saved password, ask user
         if RemotePassword = '' then
         begin
           if not TFormPasswordDialog.Execute(FCurrentRemoteID, RemotePassword, RememberPassword) then
           begin
             memoLog.Lines.Add('Conexão cancelada pelo usuário');
             Exit;
           end;

           // Trim password to avoid whitespace issues
           RemotePassword := Trim(RemotePassword);
           memoLog.Lines.Add('Password provided. Len: ' + IntToStr(Length(RemotePassword)));

           // Save password if requested
           if RememberPassword and (RemotePassword <> '') then
           begin
             FStorage.SavePassword(FCurrentRemoteID, RemotePassword);
             FStorage.Save;
           end;
         end
         else
         begin
            RemotePassword := Trim(RemotePassword); // Ensure saved password is trimmed too
            memoLog.Lines.Add('Using saved password. Len: ' + IntToStr(Length(RemotePassword)));
         end;
         
         if RemotePassword <> '' then
         begin
           FLastPassword := RemotePassword;
           FBridge.Connect(FCurrentRemoteID);
           FStorage.AddRecent(FCurrentRemoteID);
           FStorage.Save;
         end
         else
           memoLog.Lines.Add('Conexão cancelada: senha não informada');
           
         SkPaintBoxMain.Redraw;
       end;
    end;
  end;
end;

procedure TFormMain.FormKeyDown(Sender: TObject; var Key: Word; Shift: TShiftState);
begin
  if (ssCtrl in Shift) then
  begin
    case Key of
      ord('W'): // Ctrl + W: Close active session
        if FActiveTabID <> 'dashboard' then
        begin
          memoLog.Lines.Add('Shortcut: Closing session ' + FActiveTabID);
          FBridge.SendCommand('REMOVE_CONN', TJSONObject.Create.AddPair('remoteId', FActiveTabID));
          FActiveSessions.Delete(FActiveSessions.IndexOf(FActiveTabID));
          FActiveTabID := 'dashboard';
          FormResize(nil);
          SkPaintBoxMain.Redraw;
        end;
      ord('T'): // Ctrl + T: Back to dashboard
        if FActiveTabID <> 'dashboard' then
        begin
           FActiveTabID := 'dashboard';
           FormResize(nil);
           SkPaintBoxMain.Redraw;
        end;
      VK_TAB: // Ctrl + Tab: Switch tabs
        begin
          if FActiveSessions.Count > 0 then
          begin
             // Not implemented for brevity, but could switch between indices
          end;
        end;
    end;
  end;
end;

procedure TFormMain.OnMenuRename(Sender: TObject);
var
  LNewAlias: string;
begin
  if FTargetSessionID = '' then Exit;
  LNewAlias := InputBox('Renomear Conexão', 'Novo apelido para ' + FTargetSessionID, '');
  if LNewAlias <> '' then
  begin
    FStorage.UpdateContact(FTargetSessionID, LNewAlias, False); // Keeps favorite status if exists
    FStorage.Save;
    SkPaintBoxMain.Redraw;
  end;
end;

procedure TFormMain.OnMenuFavorite(Sender: TObject);
var
  LContact: TContact;
  LFound: Boolean;
begin
  if FTargetSessionID = '' then Exit;
  LFound := False;
  for LContact in FStorage.Contacts do
  begin
    if LContact.ID = FTargetSessionID then
    begin
      LContact.IsFavorite := not LContact.IsFavorite;
      LFound := True;
      Break;
    end;
  end;
  
  if not LFound then
    FStorage.UpdateContact(FTargetSessionID, '', True);
    
  FStorage.Save;
  SkPaintBoxMain.Redraw;
end;

procedure TFormMain.OnMenuDelete(Sender: TObject);
var
  Idx: Integer;
begin
  if FTargetSessionID = '' then Exit;
  Idx := FStorage.RecentSessions.IndexOf(FTargetSessionID);
  if Idx <> -1 then
  begin
    FStorage.RecentSessions.Delete(Idx);
    FStorage.Save;
    SkPaintBoxMain.Redraw;
  end;
end;

procedure TFormMain.SkPaintBoxMainMouseLeave(Sender: TObject);
begin
  if FHoveredElement <> uiNone then
  begin
    FHoveredElement := uiNone;
    SkPaintBoxMain.Redraw;
  end;
end;

procedure TFormMain.SkPaintBoxMainMouseMove(Sender: TObject; Shift: TShiftState; X, Y: Integer);
var
  BtnRect: TRectF;
  SidebarRect, ContentRect, GridCardRect: TRectF;
  I, Row, Col, ColCount: Integer;
  LList: TList<string>;
  LContact: TContact;
  TabX: Integer;
  OldElement: TUIElement;
  OldIndex: Integer;
  OldID: string;
  W, H: Single;
begin
  W := SkPaintBoxMain.Width;
  H := SkPaintBoxMain.Height;
  
  OldElement := FHoveredElement;
  OldIndex := FHoveredIndex;
  OldID := FHoveredID;
  
  FHoveredElement := uiNone;
  FHoveredIndex := -1;
  FHoveredID := '';
  Screen.Cursor := crDefault;

  // 0. Session Toolbar Hover (Top Right)
  if FActiveTabID <> 'dashboard' then
  begin
    if RectF(W - 195, 8, W - 170, 32).Contains(PointF(X, Y)) then
    begin
      FHoveredElement := uiChatBtn; Screen.Cursor := crHandPoint;
    end
    else if RectF(W - 165, 8, W - 140, 32).Contains(PointF(X, Y)) then
    begin
      FHoveredElement := uiActionsBtn; Screen.Cursor := crHandPoint;
    end
    else if RectF(W - 135, 8, W - 110, 32).Contains(PointF(X, Y)) then
    begin
      FHoveredElement := uiMonitorBtn; Screen.Cursor := crHandPoint;
    end
    else if RectF(W - 105, 8, W - 80, 32).Contains(PointF(X, Y)) then
    begin
      FHoveredElement := uiViewModeBtn; Screen.Cursor := crHandPoint;
    end;
    
    if (FHoveredElement <> uiNone) then
    begin
      SkPaintBoxMain.Redraw;
      Exit;
    end;
  end;

  // 0.1 Settings Modal Hover
  if FShowSettingsModal then
  begin
    var CardRect := RectF((W/2) - 180, (H/2) - 120, (W/2) + 180, (H/2) + 100);
    if RectF(CardRect.Left + 20, CardRect.Top + 90, CardRect.Right - 20, CardRect.Top + 125).Contains(PointF(X, Y)) then
    begin
       FHoveredElement := uiSettingsIPArea; Screen.Cursor := crIBeam;
    end
    else if RectF(CardRect.Right - 120, CardRect.Bottom - 50, CardRect.Right - 20, CardRect.Bottom - 15).Contains(PointF(X, Y)) then
    begin
       FHoveredElement := uiSettingsSaveBtn; Screen.Cursor := crHandPoint;
    end
    else if RectF(CardRect.Left + 20, CardRect.Bottom - 45, CardRect.Left + 100, CardRect.Bottom - 15).Contains(PointF(X, Y)) then
    begin
       FHoveredElement := uiSettingsCancelBtn; Screen.Cursor := crHandPoint;
    end;
    
    if (FHoveredElement <> uiNone) then
    begin
       SkPaintBoxMain.Redraw;
       Exit;
    end;
  end;

  // 1. Top Bar Tabs
  if Y <= 40 then
  begin
    // Check Dashboard Tab
    if (X >= 0) and (X <= 120) then
    begin
      FHoveredElement := uiTab;
      FHoveredID := 'dashboard';
      Screen.Cursor := crHandPoint;
    end
    else
    begin
      // Session Tabs
      for I := 0 to FActiveSessions.Count - 1 do
      begin
        TabX := 120 + (I * 150);
        if (X >= TabX) and (X <= TabX + 150) then
        begin
          if X >= TabX + 120 then
            FHoveredElement := uiTabClose
          else
            FHoveredElement := uiTab;
            
          FHoveredID := FActiveSessions[I];
          Screen.Cursor := crHandPoint;
          Break;
        end;
      end;
    end;
    
    if (FHoveredElement <> OldElement) or (FHoveredID <> OldID) then SkPaintBoxMain.Redraw;
    Exit;
  end;

  // Only continue if Dashboard
  if FActiveTabID <> 'dashboard' then Exit;

  // 2. Sidebar Items
  SidebarRect := RectF(0, 40, skSidebarWidth, SkPaintBoxMain.Height);
  if SidebarRect.Contains(PointF(X, Y)) then
  begin
    // Active Banner Button
    if FIsConnected and (FIncomingPeerID <> '') then
    begin
       if RectF(skSidebarWidth - 110, 60, skSidebarWidth - 20, 100).Contains(PointF(X, Y)) then // Offset by 50 (top) + coordinates in DrawActiveConnectionBanner
       begin
         FHoveredElement := uiActiveBannerBtn;
         Screen.Cursor := crHandPoint;
       end;
    end;

    // Local ID (Sidebar) - Adjusting if banner is visible
    var SidebarOffsetY: Single := 0;
    if FIsConnected and (FIncomingPeerID <> '') then SidebarOffsetY := 70;
    
    if RectF(15, 60 + SidebarOffsetY, skSidebarWidth - 15, 110 + SidebarOffsetY).Contains(PointF(X, Y)) then
    begin
      FHoveredElement := uiSidebarCopyID;
      Screen.Cursor := crHandPoint;
    end;

    // Session Password (Sidebar regen)
    if RectF(15, 130, skSidebarWidth - 15, 180).Contains(PointF(X, Y)) then
    begin
      FHoveredElement := uiSidebarRegenPass;
      Screen.Cursor := crHandPoint;
    end;
    
    // Service Button (moved down to avoid overlap if needed, but keeping current for now)
    if RectF(20, H - 110, skSidebarWidth - 20, H - 90).Contains(PointF(X, Y)) then
    begin
      FHoveredElement := uiSidebarBtn; // Service Btn
      Screen.Cursor := crHandPoint;
    end;
    
    // Settings Shortcut
    if RectF(20, H - 75, skSidebarWidth - 20, H - 45).Contains(PointF(X, Y)) then
    begin
      FHoveredElement := uiSidebarSettings;
      Screen.Cursor := crHandPoint;
    end;
    
    if (FHoveredElement <> OldElement) then SkPaintBoxMain.Redraw;
    Exit;
  end;

  // 3. Content Area Items
  ContentRect := RectF(skSidebarWidth, 40, W, H);
  
  // Search Bar
  if RectF(ContentRect.Left + 20, 110, ContentRect.Left + 460, 145).Contains(PointF(X, Y)) then
  begin
    FHoveredElement := uiSearchBar;
    Screen.Cursor := crIBeam;
  end;

  // 4. Main Connect Button
  BtnRect := RectF(ContentRect.Left + 360, 100, ContentRect.Left + 460, 140); // Matches DrawConnectionArea
  if BtnRect.Contains(PointF(X, Y)) then
  begin
    FHoveredElement := uiConnectBtn;
    Screen.Cursor := crHandPoint;
    if (FHoveredElement <> OldElement) then SkPaintBoxMain.Redraw;
    Exit;
  end;

  // 4. Session Grid Cards
  LList := TList<string>.Create;
  try
    if FActiveTab = 'recent' then
    begin
      for OldID in FStorage.RecentSessions do LList.Add(OldID); // Reuse OldID var as temp
    end
    else
    begin
      for LContact in FStorage.Contacts do
        if LContact.IsFavorite then LList.Add(LContact.ID);
    end;

    ColCount := Trunc((ContentRect.Width - 20) / 220);
    if ColCount < 1 then ColCount := 1;

    // Adjust Y for scroll
    for I := 0 to LList.Count - 1 do
    begin
      Col := I mod ColCount;
      Row := I div ColCount;
      GridCardRect := RectF(
        ContentRect.Left + 20 + (Col * 220),
        230 + (Row * 200) - FScrollOffset,
        ContentRect.Left + 20 + (Col * 220) + 200,
        230 + (Row * 200) + 180 - FScrollOffset
      );
      
      // Hit Test taking Clip into account
      if (GridCardRect.Bottom > 215) and (GridCardRect.Top < SkPaintBoxMain.Height) then
      begin
        if GridCardRect.Contains(PointF(X, Y)) then
        begin
          FHoveredElement := uiSessionCard;
          FHoveredID := LList[I];
          Screen.Cursor := crHandPoint;
          Break;
        end;
      end;
    end;
  finally
    LList.Free;
  end;

  if (FHoveredElement <> OldElement) or (FHoveredID <> OldID) then
    SkPaintBoxMain.Redraw;
end;

procedure TFormMain.SkPaintBoxMainDraw(ASender: TObject;
  const ACanvas: ISkCanvas; const ADest: TRectF; const AOpacity: Single);
var
  LPaint: ISkPaint;
  CardRect: TRectF;
  W, H: Single;
  SidebarRect: TRectF;
  ContentRect: TRectF;
  I, Row, Col: Integer;
  GridCardRect: TRectF;
  LList: TList<string>;
  sID: string;
  LContact: TContact;
  LIsFav: Boolean;
  LAlias: string;
  ColCount: Integer;
begin

  W := ADest.Width;
  H := ADest.Height;
  
  // 1. Top Bar (Global)
  TSkUIDrawer.DrawTopTabBar(ACanvas, RectF(0, 0, W, 40));
  
  // Dashboard Tab
  TSkUIDrawer.DrawTab(ACanvas, RectF(0, 0, 120, 40), 'Painel', FActiveTabID = 'dashboard', False);
  
  // Sessions Tabs
  for I := 0 to FActiveSessions.Count - 1 do
  begin
    sID := FActiveSessions[I];
    LAlias := sID; // Fallback
    for LContact in FStorage.Contacts do
    begin
      if LContact.ID = sID then
      begin
        if LContact.Alias <> '' then LAlias := LContact.Alias;
        Break;
      end;
    end;
    TSkUIDrawer.DrawTab(ACanvas, RectF(120 + (I * 150), 0, 120 + ((I+1) * 150), 40), LAlias, FActiveTabID = sID, True);
  end;

  // Draw modals BEFORE checking active tab (so they appear on top of everything)
  if FShowAcceptanceModal then
  begin
    LPaint := TSkPaint.Create;
    LPaint.Color := $4B000000;
    ACanvas.DrawRect(ADest, LPaint);
    CardRect := RectF((W/2) - 150, (H/2) - 75, (W/2) + 150, (H/2) + 75);
    TSkUIDrawer.DrawCard(ACanvas, CardRect, skCardBG);
    TSkUIDrawer.DrawHeader(ACanvas, RectF(CardRect.Left, CardRect.Top, CardRect.Right, CardRect.Top + 40), 'Conexão Recebida');
    TSkUIDrawer.DrawLabel(ACanvas, RectF(CardRect.Left + 20, CardRect.Top + 60, CardRect.Right - 20, CardRect.Top + 90), 'De: ' + FIncomingPeerID, 12, skTextMain, True);
    TSkUIDrawer.DrawButton(ACanvas, RectF(CardRect.Left + 20, CardRect.Bottom - 45, CardRect.Left + 120, CardRect.Bottom - 15), 'Aceitar', False);
    TSkUIDrawer.DrawButton(ACanvas, RectF(CardRect.Right - 120, CardRect.Bottom - 45, CardRect.Right - 20, CardRect.Bottom - 15), 'Rejeitar', False);
  end;

  if FShowSettingsModal then
  begin
    TSkUIDrawer.DrawSettingsModal(ACanvas, ADest, FServerIP, (FHoveredElement = uiSettingsSaveBtn));
  end;

  // Only draw dashboard content if dashboard is active
  if FActiveTabID <> 'dashboard' then
  begin
    EdgeBrowser.Visible := True;
    Exit;
  end;
  
  EdgeBrowser.Visible := False; // Hide WebView while in dashboard
  editRemoteID.Visible := True;

  // 2. Draw Sidebar & Content Area
  SidebarRect := RectF(0, 0, skSidebarWidth, H);
  ContentRect := RectF(skSidebarWidth, 40, W, H);
  
  ACanvas.Clear(skBackground);
  TSkUIDrawer.DrawSidebar(ACanvas, SidebarRect, FServerConnected, FAppLogo);

  // Active Connection Banner (if someone is connected to me)
  if FIsConnected and (FIncomingPeerID <> '') then
  begin
    TSkUIDrawer.DrawActiveConnectionBanner(ACanvas, RectF(10, 50, skSidebarWidth - 10, 110), FIncomingPeerID, (FHoveredElement = uiActiveBannerBtn));
    // Offset next elements if banner is shown
    ACanvas.Save;
    ACanvas.Translate(0, 70);
  end;
  
  // Sidebar Details (Cards)
  // 1. ID Card
  TSkUIDrawer.DrawIDCard(ACanvas, RectF(10, 50, skSidebarWidth - 10, 160), FPeerID, False, False);
  
  // 2. Password Card
  TSkUIDrawer.DrawPasswordCard(ACanvas, RectF(10, 170, skSidebarWidth - 10, 280), FSessionPassword, False, False, False);

  // 3. Splash Card (Below password)
  TSkUIDrawer.DrawSplashCard(ACanvas, RectF(10, 290, skSidebarWidth - 10, 520), FAppSplash);

  if FIsConnected and (FIncomingPeerID <> '') then ACanvas.Restore;
  
  // Section: Serviço
  TSkUIDrawer.DrawSidebarSection(ACanvas, RectF(0, 530, skSidebarWidth, 560), 'SERVIÇO DE ACESSO');
  if GetMireDeskServiceStatus = ssRunning then
    TSkUIDrawer.DrawLabel(ACanvas, RectF(20, 570, skSidebarWidth - 20, 590), '● Serviço Ativo', 10, skSuccess, True)
  else
    TSkUIDrawer.DrawLabel(ACanvas, RectF(20, 570, skSidebarWidth - 20, 590), '○ Serviço Parado', 10, skDanger, True);
    
  // 5. Sidebar Footer (Version) - Back to bottom
  TSkUIDrawer.DrawSidebarFooter(ACanvas, RectF(0, H - 40, skSidebarWidth, H), FAppVersion);

  // 3. Draw Main Content Area - Shifted down by Top Bar (40px) + padding
  TSkUIDrawer.DrawConnectionArea(ACanvas, RectF(ContentRect.Left + 20, 60, ContentRect.Right - 20, 150), FHoveredElement = uiConnectBtn);

  // Line to separate connection area from the rest
  LPaint := TSkPaint.Create;
  LPaint.Color := TAlphaColor($30000000); // More visible gray
  ACanvas.DrawLine(ContentRect.Left, 165, W, 165, LPaint);


  // Tabs Placeholder (Sessions)
  LPaint := TSkPaint.Create;
  LPaint.AntiAlias := True;
  
  if FActiveTab = 'recent' then
    TSkUIDrawer.DrawLabel(ACanvas, RectF(ContentRect.Left + 20, 180, ContentRect.Left + 120, 210), 'Sessões Recentes', 10, skTextMain, True)
  else
    TSkUIDrawer.DrawLabel(ACanvas, RectF(ContentRect.Left + 20, 180, ContentRect.Left + 120, 210), 'Sessões Recentes', 10, skTextSecondary, True);

  if FActiveTab = 'favorites' then
    TSkUIDrawer.DrawLabel(ACanvas, RectF(ContentRect.Left + 140, 180, ContentRect.Left + 220, 210), 'Favoritos', 10, skTextMain, True)
  else
    TSkUIDrawer.DrawLabel(ACanvas, RectF(ContentRect.Left + 140, 180, ContentRect.Left + 220, 210), 'Favoritos', 10, skTextSecondary, True);
    
  if FActiveTab = 'recent' then
    ACanvas.DrawLine(ContentRect.Left + 20, 215, ContentRect.Left + 120, 215, LPaint)
  else
    ACanvas.DrawLine(ContentRect.Left + 140, 215, ContentRect.Left + 200, 215, LPaint);

  // Search Bar (Dash only)
  TSkUIDrawer.DrawSearchBar(ACanvas, RectF(ContentRect.Left + 20, 110, ContentRect.Left + 460, 145), FSearchTerm, (FHoveredElement = uiSearchBar));


  // Session Grid
  LList := TList<string>.Create;
  try
    if FActiveTab = 'recent' then
    begin
      for sID in FStorage.RecentSessions do
      begin
        LAlias := '';
        for LContact in FStorage.Contacts do if LContact.ID = sID then LAlias := LContact.Alias;
        
        if (FSearchTerm = '') or 
           (sID.ToLower.Contains(FSearchTerm.ToLower)) or 
           (LAlias.ToLower.Contains(FSearchTerm.ToLower)) then
          LList.Add(sID);
      end;
    end
    else
    begin
      for LContact in FStorage.Contacts do
        if LContact.IsFavorite then
        begin
          if (FSearchTerm = '') or 
             (LContact.ID.ToLower.Contains(FSearchTerm.ToLower)) or 
             (LContact.Alias.ToLower.Contains(FSearchTerm.ToLower)) then
            LList.Add(LContact.ID);
        end;
    end;

    // Dynamic Columns based on Width
    // CardWidth (200) + Padding (20) = 220
    ColCount := Trunc((ContentRect.Width - 20) / 220);
    if ColCount < 1 then ColCount := 1;

    // Calculate Max Scroll
    // Each row is 200px. Header area starts at 230px.
    // Total height = 230 + (Rows * 200)
    FMaxScroll := ( ( (LList.Count - 1) div ColCount ) + 1 ) * 200 + 230 - ContentRect.Height;
    if FMaxScroll < 0 then FMaxScroll := 0;

    // Save and Clip for Scroll
    ACanvas.Save;
    ACanvas.ClipRect(ContentRect);
    ACanvas.Translate(0, -FScrollOffset);

    for I := 0 to LList.Count - 1 do
    begin
      Col := I mod ColCount;
      Row := I div ColCount;
      GridCardRect := RectF(
        ContentRect.Left + 20 + (Col * 220),
        230 + (Row * 200),
        ContentRect.Left + 20 + (Col * 220) + 200,
        230 + (Row * 200) + 180
      );
      
      // OPTIONAL: Simple culling to improve performance if many items
      if (GridCardRect.Bottom < FScrollOffset - 100) or (GridCardRect.Top > FScrollOffset + ContentRect.Height + 100) then
        Continue;
      
      LIsFav := False;
      LAlias := '';
      for LContact in FStorage.Contacts do
        if LContact.ID = LList[I] then
        begin
          LIsFav := LContact.IsFavorite;
          LAlias := LContact.Alias;
          Break;
        end;
      
      var IsOnline: Boolean := False;
      if FOnlineMap.ContainsKey(LList[I]) then
        IsOnline := FOnlineMap[LList[I]];
        
      TSkUIDrawer.DrawSessionCard(ACanvas, GridCardRect, LList[I], LAlias, IsOnline, LIsFav, (FHoveredElement = uiSessionCard) and (FHoveredID = LList[I]), FPulseScale);
    end;
  finally
    ACanvas.Restore;
    LList.Free;
  end;


  // 4. Modals are now drawn at the beginning (before tab check)
end;

procedure TFormMain.FormMouseDown(Sender: TObject; Button: TMouseButton;

  Shift: TShiftState; X, Y: Integer);
var
  BtnRect, CardRect, GridCardRect, StarRect: TRectF;
  W, H: Single;
  I, Row, Col: Integer;
  LList: TList<string>;
  sID, sNewAlias, curAlias: string;
  LContact, c: TContact;
  LAns, TabX, ColCount: Integer;
  curFav, LIsFav: Boolean;

begin
  W := SkPaintBoxMain.Width;
  H := SkPaintBoxMain.Height;

  // 0. Session Toolbar Clicks (Logic is handled further down in the procedure)

  // 0. Top Bar Click Detection
  if Y <= 40 then
  begin
    if Button = mbRight then Exit; // No context menu on top bar for now
    // Dashboard Tab Click
    if (X >= 0) and (X <= 120) then
    begin
      FActiveTabID := 'dashboard';
      FormResize(nil);
      SkPaintBoxMain.Redraw;
      Exit;
    end;
    
    // Sessions Tabs Click
    for I := 0 to FActiveSessions.Count - 1 do
    begin
      TabX := 120 + (I * 150);
      if (X >= TabX) and (X <= TabX + 150) then

      begin
        // Detect Close Button (X area)
        if (X >= TabX + 120) then
        begin
          memoLog.Lines.Add('Closing tab: ' + FActiveSessions[I]);
          FBridge.SendCommand('REMOVE_CONN', TJSONObject.Create.AddPair('remoteId', FActiveSessions[I]));
          FActiveSessions.Delete(I);
          FActiveTabID := 'dashboard';
          FormResize(nil);
          SkPaintBoxMain.Redraw;
          Exit;
        end;

        
        
        if FActiveTabID <> FActiveSessions[I] then
        begin
          FActiveTabID := FActiveSessions[I];
          // Notify JS to show the correct video element
          FBridge.SendCommand('SWITCH_TAB', TJSONObject.Create.AddPair('remoteId', FActiveTabID));
          
          FormResize(nil);
          SkPaintBoxMain.Redraw;
        end;
        Exit;
      end;
    end;
  end;

  // Session Toolbar Clicks
  if FActiveTabID <> 'dashboard' then
  begin
    if FHoveredElement = uiChatBtn then
    begin
       FIsChatOpen := not FIsChatOpen;
       SkPaintBoxMain.Redraw;
       Exit;
    end;
    if FHoveredElement = uiMonitorBtn then
    begin
      // Logic for monitor selection (InputQuery or simple toggle for now)
      FBridge.SendCommand('SWITCH_MONITOR', TJSONObject.Create.AddPair('monitor', 1)); // Simple test
      Exit;
    end;
  end;

  // If we are in a session tab, don't handle clicks below the tab bar (Y > 40)
  if FActiveTabID <> 'dashboard' then Exit;

  if FShowAcceptanceModal then
  begin
    CardRect := RectF((W/2) - 150, (H/2) - 75, (W/2) + 150, (H/2) + 75);
    // Accept Button Hit Test
    BtnRect := RectF(CardRect.Left + 20, CardRect.Bottom - 45, CardRect.Left + 120, CardRect.Bottom - 15);
    if BtnRect.Contains(PointF(X, Y)) then
    begin
      FBridge.SendToWeb('ACCEPT_CONN', TJSONObject.Create.AddPair('remoteID', FIncomingPeerID));
      FShowAcceptanceModal := False;
      SkPaintBoxMain.Redraw;
      Exit;
    end;

    // Reject Button Hit Test
    BtnRect := RectF(CardRect.Right - 120, CardRect.Bottom - 45, CardRect.Right - 20, CardRect.Bottom - 15);
    if BtnRect.Contains(PointF(X, Y)) then
    begin
      FBridge.SendToWeb('REJECT_CONN', TJSONObject.Create.AddPair('remoteID', FIncomingPeerID));
      FShowAcceptanceModal := False;
      SkPaintBoxMain.Redraw;
      Exit;
    end;
    Exit;
  end;

  // 1. Sidebar ID Card (Copy ID)
  if (FHoveredElement = uiSidebarCopyID) and (FPeerID <> '') then
  begin
    Clipboard.AsText := FPeerID;
    memoLog.Lines.Add('ID Copiado: ' + FPeerID);
    Exit;
  end;

  // 2. Start/Stop Service Button
  if (FHoveredElement = uiSidebarBtn) then
  begin
    if GetMireDeskServiceStatus = ssRunning then
      StopMireDeskService
    else
      StartMireDeskService;
    SkPaintBoxMain.Redraw;
    Exit;
  end;
  
  // 3. Connect Button
  if (FHoveredElement = uiConnectBtn) then
  begin
    // Trigger connect logic
    var Key: Char := #13;
    editRemoteIDKeyPress(Self, Key); // Simulate enter
    Exit;
  end;

  // 4. Search Bar
  if (FHoveredElement = uiSearchBar) then
  begin
    var NewSearch: string := FSearchTerm;
    if InputQuery('Pesquisar', 'Digite o termo de busca:', NewSearch) then
    begin
      FSearchTerm := NewSearch;
      SkPaintBoxMain.Redraw;
    end;
    Exit;
  end;

  // 5. Sidebar Regen Password
  if (FHoveredElement = uiSidebarRegenPass) then
  begin
    FSessionPassword := IntToStr(100000 + Random(899999));
    memoLog.Lines.Add('Nova Senha de Sessão: ' + FSessionPassword);
    SkPaintBoxMain.Redraw;
    Exit;
  end;

  // 5.1 Sidebar Settings Open
  if (FHoveredElement = uiSidebarSettings) then
  begin
    FShowSettingsModal := True;
    SkPaintBoxMain.Redraw;
    Exit;
  end;

  // 5.2 Settings Modal Actions
  if FShowSettingsModal then
  begin
    if FHoveredElement = uiSettingsCancelBtn then
    begin
      FShowSettingsModal := False; SkPaintBoxMain.Redraw; Exit;
    end;
    if FHoveredElement = uiSettingsIPArea then
    begin
       var NewIP: string := FServerIP;
       if InputQuery('Servidor', 'IP do Servidor:', NewIP) then
         FServerIP := NewIP;
       SkPaintBoxMain.Redraw; Exit;
    end;
    if FHoveredElement = uiSettingsSaveBtn then
    begin
       SaveConfig; // Should save FServerIP
       FShowSettingsModal := False;
       if MessageDlg('Configurações salvas. Reiniciar agora?', mtConfirmation, [mbYes, mbNo], 0) = mrYes then
         Application.Terminate; // Simplified
       SkPaintBoxMain.Redraw; Exit;
    end;
  end;

  // 6. Active Banner Disconnect
  if (FHoveredElement = uiActiveBannerBtn) then
  begin
    FBridge.SendCommand('CLOSE_ALL', nil); // Or specific command to close incoming
    FIsConnected := False;
    FIncomingPeerID := '';
    SkPaintBoxMain.Redraw;
    Exit;
  end;
  
  // 7. Session Cards (Popup or Connect)
  if (FHoveredElement = uiSessionCard) and (FHoveredID <> '') then
  begin
    if Button = mbRight then
    begin
      FTargetSessionID := FHoveredID;
      // Convert Client Point to Screen Point for Popup
      var P := ClientToScreen(Point(X, Y));
      FPopupMenu.Popup(P.X, P.Y);
    end
    else
    begin
        // Check for saved password first
        var RemotePassword: string := FStorage.GetSavedPassword(FHoveredID);
        var RememberPassword: Boolean := False;
        
        // If no saved password, ask user
        if RemotePassword = '' then
        begin
          if not TFormPasswordDialog.Execute(FHoveredID, RemotePassword, RememberPassword) then
          begin
            memoLog.Lines.Add('Conexão cancelada pelo usuário');
            Exit;
          end;
          
          RemotePassword := Trim(RemotePassword);
          memoLog.Lines.Add('Password provided (Card). Len: ' + IntToStr(Length(RemotePassword)));
          
          // Save password if requested
          if RememberPassword and (RemotePassword <> '') then
          begin
            FStorage.SavePassword(FHoveredID, RemotePassword);
            FStorage.Save;
          end;
        end
        else
        begin
           RemotePassword := Trim(RemotePassword);
           memoLog.Lines.Add('Using saved password (Card). Len: ' + IntToStr(Length(RemotePassword)));
        end;
        
        if RemotePassword <> '' then
        begin
          FLastPassword := RemotePassword;
          editRemoteID.Text := FHoveredID;
          var Key: Char := #13;
          editRemoteIDKeyPress(Self, Key);
        end
        else
          memoLog.Lines.Add('Conexão cancelada: senha não informada');
    end;
    Exit;
  end;

  // 4. Tab Switching
  if (Y >= 150) and (Y <= 185) then
  begin
    if (X >= skSidebarWidth + 20) and (X <= skSidebarWidth + 130) then
    begin
      FActiveTab := 'recent';
      SkPaintBoxMain.Redraw;
      Exit;
    end;
    if (X >= skSidebarWidth + 140) and (X <= skSidebarWidth + 240) then
    begin
      FActiveTab := 'favorites';
      SkPaintBoxMain.Redraw;
      Exit;
    end;
  end;

  // 5. Connect Button (Main Area)
  // Area drawing: ARect.Left (skSidebarWidth + 20) + 360 = skSidebarWidth + 380
  // ARect.Top (60) + 40 = 100.
  // Using a slightly larger hit area (10px padding) for easier clicking
  BtnRect := RectF(skSidebarWidth + 370, 90, skSidebarWidth + 490, 150);
  if BtnRect.Contains(PointF(X, Y)) then
  begin
     memoLog.Lines.Add('Botão Conectar clicado em ' + IntToStr(X) + ',' + IntToStr(Y));
     if editRemoteID.Text <> '' then
     begin
        FCurrentRemoteID := Trim(editRemoteID.Text);
        
        // Don't connect if already active in a tab
        if FActiveSessions.IndexOf(FCurrentRemoteID) <> -1 then
        begin
           FActiveTabID := FCurrentRemoteID;
           FormResize(nil);
           SkPaintBoxMain.Redraw;
           Exit;
        end;

        FStorage.AddRecent(FCurrentRemoteID);
        FStorage.Save;
        
        // Check for saved password first
        var RemotePassword: string := FStorage.GetSavedPassword(FCurrentRemoteID);
        var RememberPassword: Boolean := False;
        
        // If no saved password, ask user
        if RemotePassword = '' then
        begin
          if not TFormPasswordDialog.Execute(FCurrentRemoteID, RemotePassword, RememberPassword) then
          begin
            memoLog.Lines.Add('Conexão cancelada pelo usuário');
            SkPaintBoxMain.Redraw;
            Exit;
          end;
          
          // Save password if requested
          if RememberPassword and (RemotePassword <> '') then
          begin
            FStorage.SavePassword(FCurrentRemoteID, RemotePassword);
            FStorage.Save;
          end;
        end;
        
        if RemotePassword <> '' then
        begin
          FLastPassword := RemotePassword;
          FBridge.Connect(FCurrentRemoteID);
        end
        else
          memoLog.Lines.Add('Conexão cancelada: senha não informada');
          
        SkPaintBoxMain.Redraw;
     end;
     Exit;
  end;

  // 6. Session Card Interactions    // List selection
    LList := TList<string>.Create;
    try
      if FActiveTab = 'recent' then
      begin
        for sID in FStorage.RecentSessions do LList.Add(sID);
      end
      else
      begin
        for LContact in FStorage.Contacts do
          if LContact.IsFavorite then LList.Add(LContact.ID);
      end;

      // Dynamic Columns for HitTest
      ColCount := Trunc((W - skSidebarWidth - 20) / 220);
      if ColCount < 1 then ColCount := 1;

      for I := 0 to LList.Count - 1 do
      begin
        Col := I mod ColCount;
        Row := I div ColCount;
        GridCardRect := RectF(
          skSidebarWidth + 20 + (Col * 220),
          230 + (Row * 200) - FScrollOffset,
          skSidebarWidth + 20 + (Col * 220) + 200,
          230 + (Row * 200) + 180 - FScrollOffset
        );
      
      if (Y > 180) and GridCardRect.Contains(PointF(X, Y)) then
      begin
        // Right Click: Context Menu (Rename / Remove)
         if Button = mbRight then
         begin
            LAns := MessageDlg('Deseja renomear ou remover este computador?', mtConfirmation, [mbYes, mbNo, mbCancel], 0, mbYes);
            if LAns = mrYes then // Rename
            begin
              sNewAlias := InputBox('Renomear', 'Digite o apelido para ' + LList[I] + ':', '');
              FStorage.UpdateContact(LList[I], sNewAlias, False); // Keeps favorite status inside UpdateContact if implemented or just fetch current
              // Fix: better fetching of existing favorite status
              curFav := False;
              for c in FStorage.Contacts do if c.ID = LList[I] then curFav := c.IsFavorite;
              FStorage.UpdateContact(LList[I], sNewAlias, curFav);
              FStorage.Save;
              SkPaintBoxMain.Redraw;
            end
            else if LAns = mrNo then // Remove
            begin
              if FActiveTab = 'recent' then
                FStorage.RecentSessions.Delete(FStorage.RecentSessions.IndexOf(LList[I]))
              else
                FStorage.UpdateContact(LList[I], '', False); // Unfavorite basically
              
              FStorage.Save;
              SkPaintBoxMain.Redraw;
            end;
            Exit;
         end;

        // Detect click on the star icon (Upper Right, 30x30 area)
        StarRect := RectF(GridCardRect.Right - 30, GridCardRect.Top, GridCardRect.Right, GridCardRect.Top + 30);

        if StarRect.Contains(PointF(X, Y)) then
        begin
          LIsFav := False;
          curAlias := '';
          for LContact in FStorage.Contacts do
            if LContact.ID = LList[I] then 
            begin
              LIsFav := LContact.IsFavorite;
              curAlias := LContact.Alias;
            end;
          
          FStorage.UpdateContact(LList[I], curAlias, not LIsFav);
          FStorage.Save;
          SkPaintBoxMain.Redraw;
          Exit;
        end;

        // Otherwise, connect
        if FActiveSessions.IndexOf(LList[I]) <> -1 then
        begin
          FActiveTabID := LList[I];
          FormResize(nil);
          SkPaintBoxMain.Redraw;
          Exit;
        end;

        FBridge.Connect(LList[I]);
        FStorage.AddRecent(LList[I]);
        FStorage.Save;
        Exit;
      end;
    end;
  finally
    LList.Free;
  end;
end;

procedure TFormMain.TimerPulseTimer(Sender: TObject);
begin
  if FPulseScale >= 1.2 then FPulseScale := 1.0;
  FPulseScale := FPulseScale + 0.05;
  SkPaintBoxMain.Redraw;
end;

procedure TFormMain.EdgeBrowserCreateWebViewCompleted(Sender: TCustomEdgeBrowser; AResult: HRESULT);
begin
  if Succeeded(AResult) then
    memoLog.Lines.Add('WebView2 Engine Ready')
  else
    memoLog.Lines.Add(Format('Error: WebView2 Initialization Failed (HRESULT: 0x%x)', [AResult]));
end;

procedure TFormMain.OnBridgeReady(Sender: TObject);
var
  Host: string;
begin
  Host := FServerIP;
  if (Host = '') or (Host = 'cloud') then
    Host := '167.234.241.147';

  memoLog.Lines.Add('Bridge JS is ready. Handshaking with ' + Host + '...');
  { Initialize with your server config }
  FBridge.Initialize(Host, 9000, '/peerjs', FPeerID);
  
  { Auto-start MJPEG capture (pointing to our Agent) }
  FBridge.StartVideo('http://127.0.0.1:9876/stream.mjpeg');
end;

procedure TFormMain.TimerClipboardTimer(Sender: TObject);
var
  CurrentText: string;
  LContact: TContact;
begin
  // Status Check every ~15s (assuming interval=1500)
  FStatusTick := FStatusTick + 1;
  if FStatusTick >= 10 then
  begin
    FStatusTick := 0;
    if Assigned(FStorage) and Assigned(FBridge) then
    begin
      var LIDs: TJSONArray := TJSONArray.Create;
      for LContact in FStorage.Contacts do
      begin
        // Skip if already in active sessions or current remote ID
        if (FActiveSessions.IndexOf(LContact.ID) = -1) and (FActiveTabID <> LContact.ID) then
          LIDs.Add(LContact.ID);
      end;
      
      if LIDs.Count > 0 then
        FBridge.CheckOnline(LIDs)
      else
        LIDs.Free;
    end;
  end;

  if not FIsConnected then Exit;
  
  try
    CurrentText := Clipboard.AsText;
    if (CurrentText <> '') and (CurrentText <> FLastClipboardText) then
    begin
      FLastClipboardText := CurrentText;
      FBridge.SendToWeb('SEND', TJSONObject.Create
        .AddPair('type', 'CLIPBOARD')
        .AddPair('text', CurrentText)
        .AddPair('remoteId', FIncomingPeerID)
      );
    end;
  except
  end;
end;

procedure TFormMain.OnPeerOpen(Sender: TObject; const PeerID: string);
begin
  FPeerID := PeerID;
  FIsConnected := True;
  FServerConnected := True;
  lblMyID.Caption := 'Your ID: ' + PeerID;
  memoLog.Lines.Add('Connected to PeerServer. My ID: ' + PeerID);
  SkPaintBoxMain.Redraw; // Force repaint to show ID on Skia card
end;

procedure TFormMain.OnPeerConnection(Sender: TObject; const RemoteID: string);
begin
  memoLog.Lines.Add('Incoming connection intent from: ' + RemoteID);
  FIncomingPeerID := RemoteID;
  FShowAcceptanceModal := True;
  
  // Also send sources list right away or after accept? 
  // Electron sends it when data channel opens. 
  // For now, let's send it when we accept or when they connect.
  SendSourcesList(RemoteID);
  
  SkPaintBoxMain.Redraw;
end;

procedure TFormMain.OnConnOpen(Sender: TObject; const RemoteID: string);
var
  LAuth: TJSONObject;
begin
  memoLog.Lines.Add('Connected to ' + RemoteID + ' (Data Channel). Sending AUTH...');
  
  // Tab creation moved to AUTH_STATUS OK
  // if FActiveSessions.IndexOf(RemoteID) = -1 then ...

  { Send Auth Packet with password }
  LAuth := TJSONObject.Create;
  LAuth.AddPair('type', 'AUTH');
  LAuth.AddPair('password', FLastPassword);
  memoLog.Lines.Add('OnConnOpen: Sending AUTH packet. PassLen: ' + IntToStr(Length(FLastPassword)));
  FBridge.SendDataJSON(RemoteID, LAuth);
end;

procedure TFormMain.OnConnClose(Sender: TObject; const RemoteID: string);
begin
  memoLog.Lines.Add('Connection closed with ' + RemoteID);
  
  if FActiveSessions.IndexOf(RemoteID) <> -1 then
  begin
    FActiveSessions.Delete(FActiveSessions.IndexOf(RemoteID));
    
    // If active tab was this session, go back to dashboard
    if FActiveTabID = RemoteID then
    begin
        FActiveTabID := 'dashboard';
        FormResize(nil);
    end;
    SkPaintBoxMain.Redraw;
  end;
end;



procedure TFormMain.OnVideoStarted(Sender: TObject; const RemoteID: string);
begin
  memoLog.Lines.Add('VIDEO STREAM STARTED! Switching to Remote View.');
  
  { NO Align := alClient here! Keep SkIA tabs visible at the top (40px) }
  FActiveTabID := RemoteID;
  FormResize(nil);
  SkPaintBoxMain.Redraw;
  EdgeBrowser.SetFocus;
end;

procedure TFormMain.OnDataReceived(Sender: TObject; const RemoteID: string; Data: TJSONValue);
var
  JSONObj, LAuth: TJSONObject;
  MsgType, NewPass: string;
begin
  memoLog.Lines.Add('Data from ' + RemoteID + ': ' + Data.ToJSON);

  
  if Data is TJSONObject then
  begin
    JSONObj := TJSONObject(Data);
    if JSONObj.TryGetValue<string>('type', MsgType) then
    begin
      if MsgType = 'AUTH' then
      begin
        memoLog.Lines.Add('AUTH request received from ' + RemoteID);
        if JSONObj.GetValue<string>('password') = FSessionPassword then
        begin
          FBridge.SendToWeb('AUTH_STATUS', TJSONObject.Create.AddPair('status', 'OK').AddPair('remoteId', RemoteID));
          memoLog.Lines.Add('Auth SUCCESS for ' + RemoteID);
        end
        else
        begin
          FBridge.SendToWeb('AUTH_STATUS', TJSONObject.Create.AddPair('status', 'FAIL').AddPair('remoteId', RemoteID));
          memoLog.Lines.Add('Auth FAILED for ' + RemoteID);
        end;
      end
      else if MsgType = 'CLIPBOARD' then
      begin
        Clipboard.AsText := JSONObj.GetValue<string>('text');
        memoLog.Lines.Add('Clipboard updated from remote');
      end
      else if MsgType = 'AUTH_STATUS' then
      begin
        if JSONObj.GetValue<string>('status') = 'OK' then
        begin
          memoLog.Lines.Add('Auth SUCCESS for ' + RemoteID);
          
          // Create Tab / Session here
          // Create Tab / Session if needed
          if FActiveSessions.IndexOf(RemoteID) = -1 then
            FActiveSessions.Add(RemoteID);
            
          // Always switch to the authenticated tab
          if FActiveTabID <> RemoteID then
          begin
            FActiveTabID := RemoteID;
            FBridge.SendCommand('SWITCH_TAB', TJSONObject.Create.AddPair('remoteId', RemoteID));
          end;
          
          FormResize(nil);
          SkPaintBoxMain.Redraw;
          
          { Initiate the Call to get the stream }
          FBridge.SendCommand('CALL', TJSONObject.Create.AddPair('remoteId', RemoteID));
        end
        else
        begin
          memoLog.Lines.Add('Auth FAILED for ' + RemoteID + '. Prompting user...');
          NewPass := FLastPassword;
          var Rem: Boolean := False;
          
          // Use the custom dialog instead of InputQuery for consistency
          if TFormPasswordDialog.Execute(RemoteID, NewPass, Rem) then
          begin
             NewPass := Trim(NewPass);
             FLastPassword := NewPass;
             memoLog.Lines.Add('Retrying Auth with new password. Len: ' + IntToStr(Length(NewPass)));
             
             LAuth := TJSONObject.Create;
             LAuth.AddPair('type', 'AUTH');
             LAuth.AddPair('password', NewPass);
             FBridge.SendDataJSON(RemoteID, LAuth);
          end
          else
          begin
             memoLog.Lines.Add('Auth retry cancelled by user');
             // Optionally close connection here
             FBridge.SendCommand('REMOVE_CONN', TJSONObject.Create.AddPair('remoteId', RemoteID));
          end;
        end;
      end
      else if MsgType = 'SOURCES_LIST' then
      begin
         memoLog.Lines.Add('Remote Sources List received (' + IntToStr(TJSONArray(JSONObj.GetValue('sources')).Count) + ' sources)');
         
         // Ensure tab/session is active as fallback
         if FActiveSessions.IndexOf(RemoteID) = -1 then
           FActiveSessions.Add(RemoteID);
           
         if FActiveTabID <> RemoteID then
         begin
           FActiveTabID := RemoteID;
           FBridge.SendCommand('SWITCH_TAB', TJSONObject.Create.AddPair('remoteId', RemoteID));
           FormResize(nil);
           SkPaintBoxMain.Redraw;
         end;
      end
      else if MsgType = 'MONITOR_CHANGED' then
      begin
         memoLog.Lines.Add('Remote Monitor changed to: ' + JSONObj.GetValue<string>('activeSourceId'));
      end
      else
      begin
        // Inject input directly!
        HandleRemoteInput(MsgType, JSONObj);
      end;
    end;
  end;
end;

procedure TFormMain.OnPeerOnlineStatus(Sender: TObject; const RemoteID: string; IsOnline: Boolean);
begin
  FOnlineMap.AddOrSetValue(RemoteID, IsOnline);
  SkPaintBoxMain.Redraw;
end;

procedure TFormMain.OnPeerError(Sender: TObject; const ErrorMsg: string);
begin
  FServerConnected := False;
  memoLog.Lines.Add('Peer Error: ' + ErrorMsg);
  memoLog.Lines.Add('The system will attempt to reconnect automatically in 5 seconds...');
  SkPaintBoxMain.Redraw;
end;

procedure TFormMain.OnLog(Sender: TObject; const Msg: string);
begin
  memoLog.Lines.Add('[JS] ' + Msg);
end;

procedure TFormMain.FormClose(Sender: TObject; var Action: TCloseAction);
begin
  // Minimize to tray instead of closing
  Action := caNone;
  Self.Hide;
end;

end.
