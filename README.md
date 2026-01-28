# MiréDesk - Remote Desktop Clone

Clone open-source do AnyDesk construído com Electron, React, TypeScript e WebRTC.

## 🚀 Funcionalidades

- **Controle Remoto de Alta Performance:** Baixa latência via Peer-to-Peer (WebRTC).
- **App Desktop:** Cliente nativo para Windows (com controle de mouse/teclado via `robotjs`).
- **Transferência de Arquivos:** Arraste e solte arquivos.
- **Chat:** Comunicação em tempo real.
- **Segurança:** Autenticação por senha e ID único.

## 🛠️ Arquitetura

- **Frontend:** React + Vite + TypeScript.
- **Desktop Wrapper:** Electron (integração nativa).
- **Backend (Sinalização):** PeerJS Server (Node.js).
- **Protocolo:** WebRTC (P2P direto App-App).

## 📦 Como Rodar (Desenvolvimento)

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Iniciar em modo Dev:**
   ```bash
   npm run dev
   # Abre duas janelas: Peer Server + App Electron
   ```
   *Ou use o script auxiliar:* `.\reiniciar-servicos.bat`

3. **Gerar Executável (Build):**
   ```bash
   .\gerar-exe.bat
   # Gera instalador/portátil na pasta dist-package/
   ```

## ☁️ Deploy (Servidor)

Para produção, consulte [DEPLOY.md](./DEPLOY.md).
O foco principal é o deploy do **PeerJS Server** via Docker para permitir conexões via internet.
