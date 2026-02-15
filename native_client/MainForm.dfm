object FormMain: TFormMain
  Left = 0
  Top = 0
  Caption = 'MireDesk Native Host'
  ClientHeight = 500
  ClientWidth = 800
  Color = clBtnFace
  DoubleBuffered = True
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -12
  Font.Name = 'Segoe UI'
  Font.Style = []
  OnCreate = FormCreate
  OnMouseDown = FormMouseDown
  TextHeight = 15
  object SkPaintBoxMain: TSkPaintBox
    Left = 0
    Top = 0
    Width = 550
    Height = 500
    Align = alClient
    OnMouseDown = FormMouseDown
    OnDraw = SkPaintBoxMainDraw
  end
  object EdgeBrowser: TEdgeBrowser
    Left = 0
    Top = 0
    Width = 100
    Height = 100
    TabOrder = 0
    AllowSingleSignOnUsingOSPrimaryAccount = False
    TargetCompatibleBrowserVersion = '117.0.2045.28'
    UserDataFolder = '%LOCALAPPDATA%\bds.exe.WebView2'
    OnCreateWebViewCompleted = EdgeBrowserCreateWebViewCompleted
  end
  object PanelSidebar: TPanel
    Left = 550
    Top = 0
    Width = 250
    Height = 500
    Align = alRight
    BevelOuter = bvNone
    Caption = ' '
    TabOrder = 1
    object lblMyID: TLabel
      Left = 16
      Top = 20
      Width = 217
      Height = 15
      AutoSize = False
      Caption = 'Your ID: Connecting...'
      Font.Charset = DEFAULT_CHARSET
      Font.Color = clWindowText
      Font.Height = -12
      Font.Name = 'Segoe UI'
      Font.Style = [fsBold]
      ParentFont = False
    end
    object editRemoteID: TEdit
      Left = 16
      Top = 45
      Width = 137
      Height = 23
      TabOrder = 0
      TextHint = 'Enter Remote ID'
      Visible = False
    end
    object btnConnect: TButton
      Left = 159
      Top = 44
      Width = 75
      Height = 25
      Caption = 'Connect'
      TabOrder = 1
      Visible = False
    end
    object memoLog: TMemo
      Left = 16
      Top = 280
      Width = 218
      Height = 200
      Font.Charset = DEFAULT_CHARSET
      Font.Color = clWindowText
      Font.Height = -11
      Font.Name = 'Segoe UI'
      Font.Style = []
      ParentFont = False
      ReadOnly = True
      ScrollBars = ssVertical
      TabOrder = 2
      Visible = False
    end
  end
  object TimerPulse: TTimer
    Interval = 50
    OnTimer = TimerPulseTimer
    Left = 40
    Top = 440
  end
end
