program MireDeskAgent;

uses
  Vcl.Forms,
  AgentForm in 'AgentForm.pas' {FormAgent},
  ServerWorker in 'ServerWorker.pas';

{$R *.res}

begin
  Application.Initialize;
  Application.MainFormOnTaskbar := False;
  Application.ShowMainForm := False;
  Application.CreateForm(TFormAgent, FormAgent);
  Application.Run;
end.
