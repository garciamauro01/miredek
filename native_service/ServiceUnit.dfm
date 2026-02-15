object MireDeskService: TMireDeskService
  OldCreateOrder = False
  DisplayName = 'MireDesk Native Service'
  OnCreate = ServiceCreate
  OnDestroy = ServiceDestroy
  OnStart = ServiceStart
  OnStop = ServiceStop
  Height = 150
  Width = 215
  object WatchdogTimer: TTimer
    Enabled = False
    Interval = 5000
    OnTimer = WatchdogTimerTimer
    Left = 88
    Top = 56
  end
end
