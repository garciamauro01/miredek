unit Unit1;

interface

uses
  Winapi.Windows, Winapi.Messages, System.SysUtils, System.Variants, System.Classes, Vcl.Graphics,
  Vcl.Controls, Vcl.Forms, Vcl.Dialogs, Vcl.Edge, WebView2;

type
  TForm1 = class(TForm)
    EdgeBrowser1: TEdgeBrowser;
    procedure FormCreate(Sender: TObject);
    procedure EdgeBrowser1CreateWebViewCompleted(Sender: TCustomEdgeBrowser;
      HResult: HRESULT);
  private
    { Private declarations }
  public
    { Public declarations }
  end

var
  Form1: TForm1;

implementation

{$R *.dfm}

procedure TForm1.EdgeBrowser1CreateWebViewCompleted(Sender: TCustomEdgeBrowser;
  HResult: HRESULT);
begin
  if Succeeded(HResult) then
  begin
    // Sucesso ao inicializar o WebView2
    // Navega para a aplicação React
    // IMPORTANTE: Altere para a URL onde você hospedou o app (ex: Vercel)
    // Para teste local, certifique-se que o "npm run dev" está rodando.
    Sender.Navigate('http://localhost:5175');
  end
  else
  begin
    ShowMessage('Falha ao inicializar WebView2. Código: ' + IntToHex(HResult, 8));
  end;
end;

procedure TForm1.FormCreate(Sender: TObject);
begin
  // Configura flags para evitar erro mDNS (-105) e forçar uso de IPs reais
  EdgeBrowser1.AdditionalBrowserArguments := 
    '--disable-features=WebRtcHideLocalIpsWithMdns ' +
    '--webrtc-ip-handling-policy=default_public_and_private_interfaces';
    
  // Inicializa o browser automaticamente ao abrir o form
  EdgeBrowser1.Navigate('about:blank');
end;

end.
