unit MireComponents;

interface

uses
  System.SysUtils, System.Types, System.UITypes, System.Classes, System.Skia,
  SkiaComponents, UIParts, Styles, Icons, StorageUtils, Vcl.ExtCtrls;

type
  TToastType = (ttSuccess, ttError, ttInfo, ttWarning);

  TSkSessionCard = class(TSkComponent)
  private
    FSessionID: string;
    FAlias: string;
    FIsFavorite: Boolean;
    FIsOnline: Boolean;
    FLastSeen: string;
    FPulseScale: Single;
    FOnFavoriteClick: TNotifyEvent;
  protected
    function GetStarRect: TRectF;
  public
    constructor Create(const ASessionID: string; const AAlias: string = ''); reintroduce;
    procedure Draw(const ACanvas: ISkCanvas; const AOpacity: Single); override;
    procedure DoClick(Button: TMouseButton; Shift: TShiftState; X, Y: Single); override;
    
    property SessionID: string read FSessionID write FSessionID;
    property Alias: string read FAlias write FAlias;
    property IsFavorite: Boolean read FIsFavorite write FIsFavorite;
    property IsOnline: Boolean read FIsOnline write FIsOnline;
    property LastSeen: string read FLastSeen write FLastSeen;
    property PulseScale: Single read FPulseScale write FPulseScale;
    property OnFavoriteClick: TNotifyEvent read FOnFavoriteClick write FOnFavoriteClick;
  end;

  TSkTab = class(TSkComponent)
  private
    FTitle: string;
    FIsActive: Boolean;
    FHasClose: Boolean;
    FOnCloseClick: TNotifyEvent;
  protected
    function GetCloseRect: TRectF;
  public
    constructor Create(const ATitle: string; AIsActive: Boolean; AHasClose: Boolean); reintroduce;
    procedure Draw(const ACanvas: ISkCanvas; const AOpacity: Single); override;
    procedure DoClick(Button: TMouseButton; Shift: TShiftState; X, Y: Single); override;
    
    property Title: string read FTitle write FTitle;
    property IsActive: Boolean read FIsActive write FIsActive;
    property HasClose: Boolean read FHasClose write FHasClose;
    property OnCloseClick: TNotifyEvent read FOnCloseClick write FOnCloseClick;
  end;

  TSkSidebarButton = class(TSkComponent)
  private
    FTitle: string;
    FIcon: string;
    FIsRunning: Boolean;
    FIsDanger: Boolean;
  public
    constructor Create(const ATitle: string; const AIcon: string; AIsDanger: Boolean = False); reintroduce;
    procedure Draw(const ACanvas: ISkCanvas; const AOpacity: Single); override;
    
    property Title: string read FTitle write FTitle;
    property Icon: string read FIcon write FIcon;
    property IsRunning: Boolean read FIsRunning write FIsRunning;
    property IsDanger: Boolean read FIsDanger write FIsDanger;
  end;

  TSkButton = class(TSkSidebarButton)
  public
    constructor Create(const AID: string; const ATitle: string; const ARect: TRectF); reintroduce;
  end;

  TSkIDCard = class(TSkComponent)
  private
    FID: string;
  public
    constructor Create(const AID: string; AIsMenuHovered, AIsInviteHovered: Boolean); reintroduce;
    procedure Draw(const ACanvas: ISkCanvas; const AOpacity: Single); override;
  end;

  TSkPasswordCard = class(TSkComponent)
  private
    FValue: string;
  public
    constructor Create(const AValue: string; AIsRefresh, AIsEdit, AIsFixed: Boolean); reintroduce;
    procedure Draw(const ACanvas: ISkCanvas; const AOpacity: Single); override;
  end;

  TSkSplashCard = class(TSkComponent)
  private
    FSplash: ISkSVGDOM;
  public
    constructor Create(const ASplash: ISkSVGDOM); reintroduce;
    procedure Draw(const ACanvas: ISkCanvas; const AOpacity: Single); override;
  end;

  TSkBanner = class(TSkComponent)
  private
    FRemoteID: string;
  public
    constructor Create(const ARemoteID: string); reintroduce;
    procedure Draw(const ACanvas: ISkCanvas; const AOpacity: Single); override;
    procedure DoClick(Button: TMouseButton; Shift: TShiftState; X, Y: Single); override;
  end;

  TSkToast = class(TSkComponent)
  private
    FMessage: string;
    FToastType: TToastType;
    FProgress: Single; // 0.0 to 1.0 for animation
    FTimer: TTimer;
    FDismissing: Boolean;
    FOnInvalidate: TNotifyEvent;
    procedure OnTimerTick(Sender: TObject);
  public
    constructor Create(const AMessage: string; AType: TToastType); reintroduce;
    destructor Destroy; override;
    procedure Draw(const ACanvas: ISkCanvas; const AOpacity: Single); override;
    procedure StartDismiss;
    property Progress: Single read FProgress write FProgress;
    property OnInvalidate: TNotifyEvent read FOnInvalidate write FOnInvalidate;
  end;

implementation

{ TSkSessionCard }

constructor TSkSessionCard.Create(const ASessionID: string; const AAlias: string);
begin
  inherited Create;
  FSessionID := ASessionID;
  FAlias := AAlias;
  ID := ASessionID;
end;

procedure TSkSessionCard.DoClick(Button: TMouseButton; Shift: TShiftState; X, Y: Single);
begin
  if GetStarRect.Contains(PointF(X, Y)) then
  begin
    if Assigned(FOnFavoriteClick) then
      FOnFavoriteClick(Self);
    Exit;
  end;
  
  inherited;
end;

procedure TSkSessionCard.Draw(const ACanvas: ISkCanvas; const AOpacity: Single);
begin
  TSkUIDrawer.DrawSessionCard(ACanvas, Bounds, SessionID, Alias, IsOnline, IsFavorite, IsHovered, FPulseScale);
end;

function TSkSessionCard.GetStarRect: TRectF;
begin
  Result := RectF(Bounds.Right - 35, Bounds.Top + 10, Bounds.Right - 5, Bounds.Top + 40);
end;

{ TSkTab }

constructor TSkTab.Create(const ATitle: string; AIsActive: Boolean; AHasClose: Boolean);
begin
  inherited Create;
  FTitle := ATitle;
  FIsActive := AIsActive;
  FHasClose := AHasClose;
end;

procedure TSkTab.DoClick(Button: TMouseButton; Shift: TShiftState; X, Y: Single);
begin
  if FHasClose and GetCloseRect.Contains(PointF(X, Y)) then
  begin
    if Assigned(FOnCloseClick) then
      FOnCloseClick(Self);
    Exit;
  end;
  
  inherited;
end;

procedure TSkTab.Draw(const ACanvas: ISkCanvas; const AOpacity: Single);
begin
  TSkUIDrawer.DrawTab(ACanvas, Bounds, Title, IsActive, HasClose);
end;

function TSkTab.GetCloseRect: TRectF;
begin
  Result := RectF(Bounds.Right - 30, Bounds.Top, Bounds.Right, Bounds.Bottom);
end;

{ TSkSidebarButton }

constructor TSkSidebarButton.Create(const ATitle: string; const AIcon: string; AIsDanger: Boolean);
begin
  inherited Create;
  FTitle := ATitle;
  FIcon := AIcon;
  FIsDanger := AIsDanger;
end;

procedure TSkSidebarButton.Draw(const ACanvas: ISkCanvas; const AOpacity: Single);
begin
  TSkUIDrawer.DrawSidebarButton(ACanvas, Bounds, Icon, Title, IsHovered, IsRunning, IsDanger);
end;

{ TSkButton }

constructor TSkButton.Create(const AID: string; const ATitle: string; const ARect: TRectF);
begin
  inherited Create(ATitle, ''); // Icon will be set via Draw logic or if we want specific icons
  Self.ID := AID;
  Self.Bounds := ARect;
end;

{ TSkIDCard }

constructor TSkIDCard.Create(const AID: string; AIsMenuHovered, AIsInviteHovered: Boolean);
begin
  inherited Create;
  FID := AID;
end;

procedure TSkIDCard.Draw(const ACanvas: ISkCanvas; const AOpacity: Single);
begin
  TSkUIDrawer.DrawIDCard(ACanvas, Bounds, FID, False, False);
end;

{ TSkPasswordCard }

constructor TSkPasswordCard.Create(const AValue: string; AIsRefresh, AIsEdit, AIsFixed: Boolean);
begin
  inherited Create;
  FValue := AValue;
end;

procedure TSkPasswordCard.Draw(const ACanvas: ISkCanvas; const AOpacity: Single);
begin
  TSkUIDrawer.DrawPasswordCard(ACanvas, Bounds, FValue, False, False, False);
end;

{ TSkSplashCard }

constructor TSkSplashCard.Create(const ASplash: ISkSVGDOM);
begin
  inherited Create;
  FSplash := ASplash;
end;

procedure TSkSplashCard.Draw(const ACanvas: ISkCanvas; const AOpacity: Single);
begin
  TSkUIDrawer.DrawSplashCard(ACanvas, Bounds, FSplash);
end;

{ TSkBanner }

constructor TSkBanner.Create(const ARemoteID: string);
begin
  inherited Create;
  FRemoteID := ARemoteID;
  ID := 'activeBannerBtn';
end;

procedure TSkBanner.DoClick(Button: TMouseButton; Shift: TShiftState; X, Y: Single);
begin
  // Check if click is on disconnect button part (X, Y are absolute coordinates)
  if RectF(Bounds.Right - 110, Bounds.Top + 10, Bounds.Right - 10, Bounds.Bottom - 10).Contains(PointF(X, Y)) then
  begin
     inherited;
  end;
end;

procedure TSkBanner.Draw(const ACanvas: ISkCanvas; const AOpacity: Single);
begin
  TSkUIDrawer.DrawActiveConnectionBanner(ACanvas, Bounds, FRemoteID, IsHovered);
end;

{ TSkToast }

constructor TSkToast.Create(const AMessage: string; AType: TToastType);
begin
  inherited Create;
  FMessage := AMessage;
  FToastType := AType;
  FProgress := 0.0;
  FDismissing := False;
  
  // Timer for animation and auto-dismiss
  FTimer := TTimer.Create(nil);
  FTimer.Interval := 16; // ~60fps
  FTimer.OnTimer := OnTimerTick;
  FTimer.Enabled := True;
end;

destructor TSkToast.Destroy;
begin
  FTimer.Free;
  inherited;
end;

procedure TSkToast.OnTimerTick(Sender: TObject);
begin
  if FDismissing then
  begin
    FProgress := FProgress - 0.05; // Fade out
    if FProgress <= 0 then
    begin
      FTimer.Enabled := False;
      Visible := False;
    end;
  end
  else
  begin
    FProgress := FProgress + 0.1; // Slide in
    if FProgress >= 1.0 then
    begin
      FProgress := 1.0;
      // Auto-dismiss after 3 seconds
      TThread.CreateAnonymousThread(procedure
      begin
        Sleep(3000);
        TThread.Synchronize(nil, procedure
        begin
          StartDismiss;
        end);
      end).Start;
      FTimer.Enabled := False;
    end;
  end;
  
  if Assigned(FOnInvalidate) then
    FOnInvalidate(Self);
end;

procedure TSkToast.StartDismiss;
begin
  FDismissing := True;
  FTimer.Enabled := True;
end;

procedure TSkToast.Draw(const ACanvas: ISkCanvas; const AOpacity: Single);
var
  LPaint: ISkPaint;
  LRect: TRectF;
  LColor: TAlphaColor;
  LAnimatedX: Single;
  LFont: ISkFont;
  LTextBlob: ISkTextBlob;
begin
  if not Visible or (FProgress <= 0) then Exit;

  // Slide animation from right
  LAnimatedX := Bounds.Right - (Bounds.Width * FProgress);
  LRect := RectF(LAnimatedX, Bounds.Top, LAnimatedX + Bounds.Width, Bounds.Bottom);

  // Background color based on type
  case FToastType of
    ttSuccess: LColor := skSuccess;
    ttError: LColor := skDanger;
    ttInfo: LColor := skInfo;
    ttWarning: LColor := skWarning;
  end;

  // Draw background with shadow
  LPaint := TSkPaint.Create;
  LPaint.Color := TAlphaColor($20000000);
  ACanvas.DrawRoundRect(RectF(LRect.Left + 4, LRect.Top + 4, LRect.Right + 4, LRect.Bottom + 4), 8, 8, LPaint);
  
  LPaint.Color := LColor;
  ACanvas.DrawRoundRect(LRect, 8, 8, LPaint);

  // Draw message text
  LFont := TSkFont.Create(TSkTypeface.MakeFromName('Segoe UI', TSkFontStyle.Normal), 14);
  LPaint.Color := TAlphaColors.White;
  LTextBlob := TSkTextBlob.MakeFromText(FMessage, LFont);
  ACanvas.DrawTextBlob(LTextBlob, LRect.Left + 16, LRect.Top + 35, LPaint);
end;

end.
