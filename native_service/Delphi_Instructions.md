# Instruções para Compilação e Instalação (Versão Final)

Agora o sistema é composto por dois executáveis:
1.  **MireDeskService.exe**: O serviço que roda no boot (System). Ele vigia o login.
2.  **MireDeskAgent.exe**: O agente que roda na sessão do usuário e captura a tela.

## 1. Compilação
Siga estes passos exatamente:

### A. Compilar o Agente
1.  Abra `native_service\MireDeskAgent.dpr`.
2.  Mude a plataforma para **Windows 64-bit**.
3.  Vá em **Project > Build MireDeskAgent**.

### B. Compilar o Serviço
1.  Abra `native_service\MireDeskService.dpr`.
2.  Mude a plataforma para **Windows 64-bit**.
3.  Vá em **Project > Build MireDeskService**.

## 2. Instalação
1.  Localize a pasta de saída (Ex: `native_service\Win64\Debug`).
2.  **IMPORTANTE**: Certifique-se de que o `MireDeskAgent.exe` está na **mesma pasta** que o `MireDeskService.exe`.
3.  Abra o CMD como **Administrador**.
4.  Execute:
    ```cmd
    MireDeskService.exe /install
    net start MireDeskService
    ```

## 3. O que acontece agora?
-   O serviço vai iniciar.
-   A cada 5 segundos, ele verifica se você está logado.
-   Assim que houver uma sessão ativa, ele lança o `MireDeskAgent.exe` "dentro" da sua área de trabalho.
-   O Agente abre o servidor na porta `9876`.
-   O Electron (Host) se conecta nesse servidor e transmite sua tela.

## 4. Unattended Access (O Teste Real)
1.  Reinicie o computador.
2.  Não faça login.
3.  Tente conectar pelo MireDesk Client de outro computador.
4.  Se o Windows estiver com **Auto-Logon**, o serviço subirá o agente e você verá a tela.
5.  Se não estiver com Auto-Logon, você verá a tela preta até logar fisicamente (ou pode tentar implementar a captura da tela de login no futuro, mas o agente já é o primeiro grande passo).
