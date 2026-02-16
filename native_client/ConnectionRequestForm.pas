unit ConnectionRequestForm;

interface

uses
  Winapi.Windows, Winapi.Messages, System.SysUtils, System.Variants, System.Classes, Vcl.Graphics,
  Vcl.Controls, Vcl.Forms, Vcl.Dialogs, System.Skia, Vcl.Skia, System.Types, System.UITypes;

type
  TFormConnectionRequest = class(TForm)
    SkPaintBox1: TSkPaintBox;
    procedure SkPaintBox1Draw(ASender: TObject; const ACanvas: ISkCanvas; const ADest: TRectF; const AOpacity: Single);
    procedure SkPaintBox1MouseDown(Sender: TObject; Button: TMouseButton; Shift: TShiftState; X, Y: Integer);
    procedure FormCreate(Sender: TObject);
    procedure SkPaintBox1MouseMove(Sender: TObject; Shift: TShiftState; X, Y: Integer);
  private
    FRemoteID: string;
    FResult: Integer; // 1 = Accept, 0 = Reject
    FHoveredBtn: Integer; // 0 = None, 1 = Accept, 2 = Reject
  public
    class function Execute(const ARemoteID: string): Boolean;
    property RemoteID: string read FRemoteID write FRemoteID;
  end;

implementation

{$R *.dfm}

{ TFormConnectionRequest }

procedure TFormConnectionRequest.FormCreate(Sender: TObject);
begin
  FResult := 0;
  FHoveredBtn := 0;
  
  BorderStyle := bsNone;
  FormStyle := fsStayOnTop;
  Position := poScreenCenter;
  Width := 400;
  Height := 300;
end;

class function TFormConnectionRequest.Execute(const ARemoteID: string): Boolean;
var
  LForm: TFormConnectionRequest;
begin
  LForm := TFormConnectionRequest.Create(nil);
  try
    LForm.RemoteID := ARemoteID;
    LForm.ShowModal;
    Result := LForm.FResult = 1;
  finally
    LForm.Free;
  end;
end;

procedure TFormConnectionRequest.SkPaintBox1Draw(ASender: TObject; const ACanvas: ISkCanvas; const ADest: TRectF; const AOpacity: Single);
var
  LPaint: ISkPaint;
  LRect: TRectF;
  LFont: ISkFont;
  LTypeface: ISkTypeface;
  LAcceptRect, LRejectRect: TRectF;
begin
  LPaint := TSkPaint.Create;
  LTypeface := TSkTypeface.MakeFromName('Segoe UI', TSkFontStyle.Bold);
  LFont := TSkFont.Create(LTypeface, 18);

  // Background Slate 900
  LPaint.Color := $FF0F172A; 
  ACanvas.DrawRect(ADest, LPaint);

  // Card Background Slate 800 with Border
  LRect := RectF(10, 10, ADest.Width - 10, ADest.Height - 10);
  LPaint.Color := $FF1E293B;
  ACanvas.DrawRoundRect(LRect, 16, 16, LPaint);
  
  LPaint.Style := TSkPaintStyle.Stroke;
  LPaint.Color := $33FFFFFF; // Subtle white border
  ACanvas.DrawRoundRect(LRect, 16, 16, LPaint);
  LPaint.Style := TSkPaintStyle.Fill;

  // Icon / Avatar Placeholder
  LPaint.Color := $FF334155;
  ACanvas.DrawCircle(ADest.CenterPoint.X, 70, 40, LPaint);
  
  // User Icon (Simple Silhouette)
  LPaint.Color := TAlphaColors.White;
  LFont.Size := 32;
  ACanvas.DrawSimpleText('?', ADest.CenterPoint.X - 12, 82, LFont, LPaint);
  
  // Text: Connection Request
  LFont.Size := 16;
  ACanvas.DrawSimpleText('Solicitação de Suporte', ADest.CenterPoint.X - 85, 145, LFont, LPaint);
  
  LFont.Size := 12;
  LFont.Typeface := TSkTypeface.MakeFromName('Segoe UI', TSkFontStyle.Normal);
  LPaint.Color := $FFA1A1AA; // Zinc 400
  var Msg: string := 'O usuário ' + FRemoteID + ' está';
  ACanvas.DrawSimpleText(Msg, ADest.CenterPoint.X - 80, 170, LFont, LPaint);
  ACanvas.DrawSimpleText('solicitando acesso ao seu computador.', ADest.CenterPoint.X - 105, 190, LFont, LPaint);

  // Buttons
  LAcceptRect := RectF(ADest.CenterPoint.X + 10, 230, ADest.CenterPoint.X + 150, 275);
  LRejectRect := RectF(ADest.CenterPoint.X - 150, 230, ADest.CenterPoint.X - 10, 275);

  // Reject Button
  if FHoveredBtn = 2 then
    LPaint.Color := $FFDC2626 // red-600
  else
    LPaint.Color := $FFEF4444; // red-500
    
  ACanvas.DrawRoundRect(LRejectRect, 10, 10, LPaint);
  LPaint.Color := TAlphaColors.White;
  LFont.Size := 12;
  LFont.Typeface := TSkTypeface.MakeFromName('Segoe UI', TSkFontStyle.Bold);
  ACanvas.DrawSimpleText('RECUSAR', LRejectRect.Left + 42, LRejectRect.Top + 28, LFont, LPaint);

  // Accept Button
  if FHoveredBtn = 1 then
    LPaint.Color := $FF16A34A // green-600
  else
    LPaint.Color := $FF22C55E; // green-500
    
  ACanvas.DrawRoundRect(LAcceptRect, 10, 10, LPaint);
  LPaint.Color := TAlphaColors.White;
  ACanvas.DrawSimpleText('ACEITAR', LAcceptRect.Left + 45, LAcceptRect.Top + 28, LFont, LPaint);
end;

procedure TFormConnectionRequest.SkPaintBox1MouseDown(Sender: TObject; Button: TMouseButton; Shift: TShiftState; X, Y: Integer);
var
  LAcceptRect, LRejectRect: TRectF;
begin
  LAcceptRect := RectF(Width / 2 + 10, 230, Width / 2 + 150, 275);
  LRejectRect := RectF(Width / 2 - 150, 230, Width / 2 - 10, 275);

  if LAcceptRect.Contains(PointF(X, Y)) then
  begin
    FResult := 1;
    ModalResult := mrOk;
  end;

  if LRejectRect.Contains(PointF(X, Y)) then
  begin
    FResult := 0;
    ModalResult := mrCancel;
  end;
end;

procedure TFormConnectionRequest.SkPaintBox1MouseMove(Sender: TObject; Shift: TShiftState; X, Y: Integer);
var
  LAcceptRect, LRejectRect: TRectF;
  LOldHover: Integer;
begin
  LOldHover := FHoveredBtn;
  LAcceptRect := RectF(Width / 2 + 10, 230, Width / 2 + 150, 275);
  LRejectRect := RectF(Width / 2 - 150, 230, Width / 2 - 10, 275);

  if LAcceptRect.Contains(PointF(X, Y)) then
    FHoveredBtn := 1
  else if LRejectRect.Contains(PointF(X, Y)) then
    FHoveredBtn := 2
  else
    FHoveredBtn := 0;
    
  if LOldHover <> FHoveredBtn then
    SkPaintBox1.Redraw;
end;

end.
