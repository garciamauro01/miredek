object FormPasswordDialog: TFormPasswordDialog
  Left = 0
  Top = 0
  BorderStyle = bsNone
  Caption = 'Conectar'
  ClientHeight = 280
  ClientWidth = 450
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -12
  Font.Name = 'Segoe UI'
  Font.Style = []
  Position = poScreenCenter
  OnCreate = FormCreate
  OnKeyPress = FormKeyPress
  OnMouseDown = FormMouseDown
  OnMouseMove = FormMouseMove
  TextHeight = 15
  object SkPaintBox: TSkPaintBox
    Left = 0
    Top = 0
    Width = 450
    Height = 280
    Align = alClient
    OnMouseDown = FormMouseDown
    OnMouseMove = FormMouseMove
    OnDraw = SkPaintBoxDraw
  end
  object editPassword: TEdit
    Left = 40
    Top = 120
    Width = 370
    Height = 32
    BorderStyle = bsNone
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -15
    Font.Name = 'Segoe UI'
    Font.Style = []
    ParentFont = False
    PasswordChar = #8226
    TabOrder = 0
    OnChange = editPasswordChange
  end
end
