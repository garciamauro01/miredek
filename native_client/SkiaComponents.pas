unit SkiaComponents;

interface

uses
  System.SysUtils, System.Types, System.UITypes, System.Classes, System.Skia,
  System.Generics.Collections;

type
  TSkComponent = class;

  TSkMouseEnterEvent = procedure(Sender: TSkComponent) of object;
  TSkMouseLeaveEvent = procedure(Sender: TSkComponent) of object;
  TSkClickEvent = procedure(Sender: TSkComponent; Button: TMouseButton; Shift: TShiftState; X, Y: Single) of object;

  TSkAnchor = (akLeft, akTop, akRight, akBottom);
  TSkAnchors = set of TSkAnchor;

  TSkComponent = class
  private
    FBounds: TRectF;
    FVisible: Boolean;
    FEnabled: Boolean;
    FIsHovered: Boolean;
    FOnMouseEnter: TSkMouseEnterEvent;
    FOnMouseLeave: TSkMouseLeaveEvent;
    FOnClick: TSkClickEvent;
    FID: string;
    FTag: Integer;
    FAnchors: TSkAnchors;
    FMargins: TRectF; // Left, Top, Right, Bottom
    procedure SetIsHovered(const Value: Boolean);
    procedure ApplyAnchors(const AOldParentRect, ANewParentRect: TRectF); virtual;
  protected
    procedure SetBounds(const Value: TRectF); virtual;
    procedure DoMouseEnter; virtual;
    procedure DoMouseLeave; virtual;
    procedure DoClick(Button: TMouseButton; Shift: TShiftState; X, Y: Single); virtual;
  public
    constructor Create; virtual;
    procedure Draw(const ACanvas: ISkCanvas; const AOpacity: Single); virtual; abstract;
    function HitTest(const X, Y: Single): Boolean; virtual;
    
    property ID: string read FID write FID;
    property Tag: Integer read FTag write FTag;
    property Bounds: TRectF read FBounds write SetBounds;
    property Visible: Boolean read FVisible write FVisible;
    property Enabled: Boolean read FEnabled write FEnabled;
    property IsHovered: Boolean read FIsHovered write SetIsHovered;
    property Anchors: TSkAnchors read FAnchors write FAnchors;
    property Margins: TRectF read FMargins write FMargins;
    
    property OnMouseEnter: TSkMouseEnterEvent read FOnMouseEnter write FOnMouseEnter;
    property OnMouseLeave: TSkMouseLeaveEvent read FOnMouseLeave write FOnMouseLeave;
    property OnClick: TSkClickEvent read FOnClick write FOnClick;
  end;

  TSkComponentGroup = class(TSkComponent)
  private
    FChildren: TObjectList<TSkComponent>;
  public
    constructor Create; override;
    destructor Destroy; override;
    procedure Draw(const ACanvas: ISkCanvas; const AOpacity: Single); override;
    function HitTest(const X, Y: Single): Boolean; override;
    procedure SetBounds(const Value: TRectF); override;
    procedure Add(AComponent: TSkComponent);
    function HandleMouseMove(const X, Y: Single): TSkComponent;
    function HandleClick(Button: TMouseButton; Shift: TShiftState; X, Y: Single): TSkComponent;
    
    property Children: TObjectList<TSkComponent> read FChildren;
  end;

implementation

{ TSkComponent }

constructor TSkComponent.Create;
begin
  FVisible := True;
  FEnabled := True;
  FIsHovered := False;
  FAnchors := [akLeft, akTop];
  FMargins := RectF(0, 0, 0, 0);
end;

procedure TSkComponent.DoClick(Button: TMouseButton; Shift: TShiftState; X, Y: Single);
begin
  if Assigned(FOnClick) then
    FOnClick(Self, Button, Shift, X, Y);
end;

procedure TSkComponent.DoMouseEnter;
begin
  if Assigned(FOnMouseEnter) then
    FOnMouseEnter(Self);
end;

procedure TSkComponent.DoMouseLeave;
begin
  if Assigned(FOnMouseLeave) then
    FOnMouseLeave(Self);
end;

function TSkComponent.HitTest(const X, Y: Single): Boolean;
begin
  Result := FVisible and FBounds.Contains(PointF(X, Y));
end;

procedure TSkComponent.SetBounds(const Value: TRectF);
begin
  FBounds := Value;
end;

procedure TSkComponent.ApplyAnchors(const AOldParentRect, ANewParentRect: TRectF);
var
  LNewBounds: TRectF;
begin
  if (AOldParentRect.Width = 0) or (AOldParentRect.Height = 0) then Exit;
  if FAnchors = [akLeft, akTop] then Exit; // Default, no change needed if relative to top-left

  LNewBounds := FBounds;

  if akRight in FAnchors then
  begin
    if akLeft in FAnchors then
      LNewBounds.Right := LNewBounds.Right + (ANewParentRect.Width - AOldParentRect.Width)
    else
    begin
      var LWidth := FBounds.Width;
      LNewBounds.Right := ANewParentRect.Width - (AOldParentRect.Width - FBounds.Right);
      LNewBounds.Left := LNewBounds.Right - LWidth;
    end;
  end;

  if akBottom in FAnchors then
  begin
    if akTop in FAnchors then
      LNewBounds.Bottom := LNewBounds.Bottom + (ANewParentRect.Height - AOldParentRect.Height)
    else
    begin
      var LHeight := FBounds.Height;
      LNewBounds.Bottom := ANewParentRect.Height - (AOldParentRect.Height - FBounds.Bottom);
      LNewBounds.Top := LNewBounds.Bottom - LHeight;
    end;
  end;

  FBounds := LNewBounds;
end;

procedure TSkComponent.SetIsHovered(const Value: Boolean);
begin
  if FIsHovered <> Value then
  begin
    FIsHovered := Value;
    if FIsHovered then DoMouseEnter else DoMouseLeave;
  end;
end;

{ TSkComponentGroup }

constructor TSkComponentGroup.Create;
begin
  inherited;
  FChildren := TObjectList<TSkComponent>.Create(True);
end;

destructor TSkComponentGroup.Destroy;
begin
  FChildren.Free;
  inherited;
end;

procedure TSkComponentGroup.Add(AComponent: TSkComponent);
begin
  FChildren.Add(AComponent);
end;

procedure TSkComponentGroup.SetBounds(const Value: TRectF);
var
  LOldRect: TRectF;
  LChild: TSkComponent;
begin
  LOldRect := FBounds;
  inherited SetBounds(Value);
  
  if (LOldRect.Width <> Value.Width) or (LOldRect.Height <> Value.Height) then
  begin
    for LChild in FChildren do
      LChild.ApplyAnchors(LOldRect, Value);
  end;
end;

procedure TSkComponentGroup.Draw(const ACanvas: ISkCanvas; const AOpacity: Single);
var
  LChild: TSkComponent;
begin
  if not Visible then Exit;
  for LChild in FChildren do
    if LChild.Visible then
      LChild.Draw(ACanvas, AOpacity);
end;

function TSkComponentGroup.HandleClick(Button: TMouseButton; Shift: TShiftState; X, Y: Single): TSkComponent;
var
  I: Integer;
  LComp: TSkComponent;
begin
  Result := nil;
  if not Visible then Exit;
  // Iterate backwards for Z-order
  for I := FChildren.Count - 1 downto 0 do
  begin
    LComp := FChildren[I];
    if LComp.HitTest(X, Y) then
    begin
      LComp.DoClick(Button, Shift, X, Y);
      Result := LComp;
      Exit;
    end;
  end;
end;

function TSkComponentGroup.HandleMouseMove(const X, Y: Single): TSkComponent;
var
  I: Integer;
  LChild: TSkComponent;
begin
  Result := nil;
  if not Visible then Exit;
  for I := FChildren.Count - 1 downto 0 do
  begin
    LChild := FChildren[I];
    if (Result = nil) and LChild.HitTest(X, Y) then
    begin
      LChild.IsHovered := True;
      Result := LChild;
    end
    else
    begin
      LChild.IsHovered := False;
    end;
  end;
end;

function TSkComponentGroup.HitTest(const X, Y: Single): Boolean;
var
  LChild: TSkComponent;
begin
  Result := False;
  if not Visible then Exit;
  for LChild in FChildren do
    if LChild.HitTest(X, Y) then
    begin
      Result := True;
      Exit;
    end;
end;

end.
