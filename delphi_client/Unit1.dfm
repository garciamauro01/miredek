object Form1: TForm1
  Left = 0
  Top = 0
  Caption = 'Clone AnyDesk (Delphi Client)'
  ClientHeight = 600
  ClientWidth = 800
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  OldCreateOrder = False
  OnCreate = FormCreate
  PixelsPerInch = 96
  TextHeight = 13
  object EdgeBrowser1: TEdgeBrowser
    Left = 0
    Top = 0
    Width = 800
    Height = 600
    Align = alClient
    TabOrder = 0
    OnCreateWebViewCompleted = EdgeBrowser1CreateWebViewCompleted
  end
end
