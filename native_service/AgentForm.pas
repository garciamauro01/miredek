unit AgentForm;

interface

uses
  Winapi.Windows, Winapi.Messages, System.SysUtils, System.Variants, System.Classes, Vcl.Graphics,
  Vcl.Controls, Vcl.Forms, Vcl.Dialogs, Vcl.StdCtrls,
  ServerWorker;

type
  TFormAgent = class(TForm)
    Label1: TLabel;
    procedure FormCreate(Sender: TObject);
    procedure FormDestroy(Sender: TObject);
  private
    FWorker: TServiceWorker;
  public
    { Public declarations }
  end;

var
  FormAgent: TFormAgent;

implementation

{$R *.dfm}

procedure TFormAgent.FormCreate(Sender: TObject);
begin
  // Inicia o worker de captura
  FWorker := TServiceWorker.Create;
  FWorker.Start;
  
  Label1.Caption := 'MireDesk Agent Running on Port 9876';
end;

procedure TFormAgent.FormDestroy(Sender: TObject);
begin
  if Assigned(FWorker) then
  begin
    FWorker.Stop;
    FWorker.Free;
  end;
end;

end.
