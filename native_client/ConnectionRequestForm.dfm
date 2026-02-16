object FormConnectionRequest: TFormConnectionRequest
  Left = 0
  Top = 0
  BorderStyle = bsNone
  Caption = 'Solicita'#231#227'o de Conex'#227'o'
  ClientHeight = 300
  ClientWidth = 400
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -12
  Font.Name = 'Segoe UI'
  Font.Style = []
  OldCreateOrder = False
  Position = poScreenCenter
  OnCreate = FormCreate
  PixelsPerInch = 96
  TextHeight = 15
  object SkPaintBox1: TSkPaintBox
    Left = 0
    Top = 0
    Width = 400
    Height = 300
    Align = alClient
    OnDraw = SkPaintBox1Draw
    OnMouseDown = SkPaintBox1MouseDown
    OnMouseMove = SkPaintBox1MouseMove
    ExplicitLeft = 144
    ExplicitTop = 88
    ExplicitWidth = 100
    ExplicitHeight = 100
  end
end
