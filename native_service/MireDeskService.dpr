program MireDeskService;

uses
  Vcl.SvcMgr,
  ServiceUnit in 'ServiceUnit.pas' {MireDeskService: TService},
  ServerWorker in 'ServerWorker.pas';

{$R *.RES}

begin
  // Windows 2003 Server requires StartServiceCtrlDispatcher to be called before CoRegisterClassObject,
  // which can be achieved by calling RegisterServiceCtrlHandler with a 0 service status handle.
  if not Application.DelayInitialize or Application.Installing then
    Application.Initialize;
  Application.CreateForm(TMireDeskService, MireService);
  Application.Run;
end.
