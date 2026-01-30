# Guia de Deploy - MiréDesk (App-to-App)

Este guia foca na arquitetura **App-to-App** (Desktop ↔ Desktop), onde o servidor atua apenas como sinalizador WebRTC.

## 🚀 Visão Geral

- **Foco:** Conexão remota entre aplicativos Desktop (Windows/Linux/Mac).
- **Servidor:** PeerJS Server (Sinalização WebRTC).
- **HTTPS:** **Não obrigatório** (Electron não tem restrições de segurança como navegadores).
- **Web Client:** Agora suportado via Docker (útil para acesso via navegador).

---

## ☁️ Deploy em Produção (VPS/Cloud)

O objetivo é subir apenas o **Servidor PeerJS** para permitir que os clientes se encontrem.

### 1. Pré-requisitos
- Um servidor VPS (DigitalOcean, AWS, Google Cloud, Oracle Free Tier, etc.)
- Docker e Docker Compose instalados.

### 2. Instalação

Copie o repositório completo (ou os arquivos essenciais) para o servidor e rode:

```bash
# Iniciar todos os serviços (Sinalização + Web Client)
docker-compose up -d --build
```

> [!NOTE]
> O Docker agora compila o projeto automaticamente através de builds multi-estágio. Não é necessário rodar `npm run build` na sua máquina local antes de enviar para o servidor.

### 3. Verificar Status

```bash
docker ps
# Deve mostrar: miredesk-peer-server rodando na porta 9000
```

Seu servidor está pronto!
**Endereço:** `http://SEU_IP_PUBLICO:9000`

---

## 💻 Configurando o App Desktop

Agora é muito simples configurar o IP do seu servidor cloud ao gerar o executável:

1. Execute o script de build:
   ```powershell
   .\gerar-exe.bat
   ```
2. O script perguntará: **"Digite o IP do Servidor"**.
3. Insira o IP da sua VPS (ex: `123.45.67.89`) e aperte Enter.
4. O instalador gerado em `dist-package/` já virá pré-configurado para conectar ao seu servidor!

> [!TIP]
> Você também pode fixar o IP padrão no arquivo `.env` alterando a variável `VITE_SERVER_IP`.

---

## 🔒 Opção: HTTPS (Opcional)

Se desejar usar HTTPS (ex: para websocket seguro `wss://`), use **Cloudflare Tunnel**:

1. Instale `cloudflared` no servidor.
2. Crie um tunnel apontando para `http://localhost:9000`.
3. No App Desktop, use:
```typescript
const peer = new Peer(id, {
  host: 'peer.seudominio.com',
  port: 443,
  secure: true, // Agora sim, true!
});
```
