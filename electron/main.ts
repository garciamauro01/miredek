import { app, BrowserWindow, desktopCapturer, ipcMain, session, Tray, Menu, nativeImage, clipboard, shell } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- BLOQUEIO DE ÚNICA INSTÂNCIA ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Main] Já existe uma instância rodando. Encerrando esta.');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Alguém tentou rodar uma segunda instância, focamos na nossa janela.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // --- CONFIGURAÇÃO DE REDE E WEBRTC (DEVE VIR ANTES DE QUAQUER INICIALIZAÇÃO) ---
  // Fix para erro mDNS (-105) e instabilidades de rede
  app.commandLine.appendSwitch('disable-features', 'WidgetLayering,WebRtcHideLocalIpsWithMdns,WebRTC-HideLocalIpsWithMdns');
  app.commandLine.appendSwitch('webrtc-ip-handling-policy', 'default_public_and_private_interfaces');
  app.commandLine.appendSwitch('enforce-webrtc-ip-permission-check');
  app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'default_public_and_private_interfaces');
  app.commandLine.appendSwitch('enable-features', 'WebRtcAllowInputVolumeAdjustment');
  // Desativa especificamente o fallback de mDNS que gera o erro -105 no Windows
  app.commandLine.appendSwitch('disable-mdns-fallback-on-name-resolution-failure');
  // ------------------------------------------------------------------------------

  // Desativa aceleração de hardware (resolve problemas de janelas pretas/invisíveis no Windows)
  // app.disableHardwareAcceleration();

  let mainWindow: BrowserWindow | null = null;
  let tray: Tray | null = null;
  let isQuitting = false;

  // Evita conflitos de cache entre instâncias de desenvolvimento
  if (!app.isPackaged) {
    app.setPath('userData', join(app.getPath('userData'), 'mire-desk-dev'));
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1000,
      height: 800,
      center: true,
      show: true,
      alwaysOnTop: false, // Permite que outras janelas se sobreponham normalmente
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, 'preload.js'),
      },
    });

    console.log('Caminho do Preload:', join(__dirname, 'preload.js'));

    if (process.env.VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      mainWindow.loadFile(join(__dirname, '../dist/index.html'));
    }

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Falha ao carregar frontend:', errorCode, errorDescription);
    });

    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        console.log('[Main] Evento de fechamento detectado - Ocultando janela');
        event.preventDefault();
        mainWindow?.hide();
      } else {
        console.log('[Main] Encerrando aplicativo permanentemente');
      }
    });

    mainWindow.on('ready-to-show', () => {
      console.log('Janela pronta para exibição!');
      mainWindow?.show();
      mainWindow?.focus();
    });
  }

  function createTray() {
    try {
      const iconPath = app.isPackaged
        ? join(process.resourcesPath, 'icon.png') // Caminho no build
        : join(__dirname, '../public/icon.png'); // Caminho no dev

      console.log('[Main] Tentando carregar ícone do Tray de:', iconPath);
      const icon = nativeImage.createFromPath(iconPath);

      if (icon.isEmpty()) {
        console.error('[Main] FALHA: Ícone carregado está vazio!');
      }

      tray = new Tray(icon.resize({ width: 16, height: 16 }));

      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Abrir Miré-Desk', click: () => {
            console.log('[Tray] Solicitando abertura da janela');
            mainWindow?.show();
            mainWindow?.focus();
          }
        },
        { type: 'separator' },
        {
          label: 'Sair', click: () => {
            console.log('[Tray] Solicitando saída definitiva');
            isQuitting = true;
            app.quit();
          }
        }
      ]);

      tray.setToolTip('Miré-Desk - Acesso Remoto');
      tray.setContextMenu(contextMenu);

      tray.on('double-click', () => {
        mainWindow?.show();
      });
      console.log('[Main] Tray criado com sucesso!');
    } catch (err) {
      console.error('[Main] Erro fatal ao criar Tray:', err);
    }
  }

  app.whenReady().then(() => {
    createWindow();
    createTray();
  });

  app.on('before-quit', () => {
    console.log('[Main] before-quit disparado');
    isQuitting = true;
  });

  app.on('window-all-closed', () => {
    console.log('[Main] window-all-closed disparado');
    if (process.platform !== 'darwin') {
      if (isQuitting) {
        app.quit();
      }
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  const { screen } = require('electron');

  // Manipulador para obter as fontes de tela
  ipcMain.handle('get-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      const displays = screen.getAllDisplays();
      const primaryDisplay = screen.getPrimaryDisplay();

      return sources.map(source => {
        // Tenta encontrar o display correspondente via display_id ou nome
        const display = displays.find(d => d.id.toString() === source.display_id) ||
          (source.name.toLowerCase().includes('screen 1') ? primaryDisplay : displays[0]);

        return {
          id: source.id,
          name: source.name,
          thumbnail: source.thumbnail.toDataURL(),
          isPrimary: source.display_id === primaryDisplay.id.toString() || source.name.toLowerCase().includes('screen 1'),
          bounds: display ? display.bounds : primaryDisplay.bounds
        };
      });
    } catch (error) {
      console.error('Erro fatal ao capturar fontes:', error);
      return [];
    }
  });

  // --- CONTROLE REMOTO (INPUT) ---
  let robot: any = null;
  try {
    // Tenta carregar robotjs APENAS se estiver disponível (compilado corretamente)
    // Usa require dinâmico para evitar crash se a lib nativa falhar
    robot = require('robotjs');
    // Ajusta delay do mouse para 0 para ser mais fluido
    robot.setMouseDelay(0);
  } catch (e) {
    console.error('ERRO: Falha ao carregar robotjs. Controle remoto não funcionará.', e);
  }

  ipcMain.handle('execute-input', async (event, data) => {
    if (!robot) return;

    try {
      const { type } = data;
      const primaryDisplay = screen.getPrimaryDisplay();
      // Usa os bounds fornecidos ou cai de volta para a tela principal
      const bounds = data.activeSourceBounds || primaryDisplay.bounds;

      switch (type) {
        case 'mousemove':
          // Converte coordenadas normalizadas (0-1) para pixels globais
          const x = bounds.x + (data.x * bounds.width);
          const y = bounds.y + (data.y * bounds.height);
          robot.moveMouse(x, y);
          break;

        case 'mousedown':
          robot.mouseToggle('down', data.button);
          break;

        case 'mouseup':
          robot.mouseToggle('up', data.button);
          break;

        case 'keydown':
          // Mapeamento básico. Robotjs usa nomes de teclas específicos.
          // data.key pode ser 'a', 'b', 'Enter', 'Backspace', etc.
          try {
            // Normaliza teclas especiais se necessário
            let key = data.key.toLowerCase();
            if (key === 'arrowup') key = 'up';
            if (key === 'arrowdown') key = 'down';
            if (key === 'arrowleft') key = 'left';
            if (key === 'arrowright') key = 'right';

            robot.keyToggle(key, 'down');
          } catch (err) {
            console.log('Tecla não suportada pelo robotjs:', data.key);
          }
          break;

        case 'keyup':
          try {
            let key = data.key.toLowerCase();
            if (key === 'arrowup') key = 'up';
            if (key === 'arrowdown') key = 'down';
            if (key === 'arrowleft') key = 'left';
            if (key === 'arrowright') key = 'right';

            robot.keyToggle(key, 'up');
          } catch (e) { }
          break;
      }
    } catch (error) {
      console.error('Erro ao executar input remoto:', error);
    }
  });

  // --- CONFIGURAÇÕES DE AUTO-START ---
  ipcMain.handle('get-autostart-status', () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('set-autostart', (event, value: boolean) => {
    console.log('[Main] Configurando auto-início para:', value);
    const exePath = app.getPath('exe');
    console.log('[Main] Caminho do executável para auto-início:', exePath);

    app.setLoginItemSettings({
      openAtLogin: value,
      path: exePath,
      args: ['--hidden'] // Sugestão: iniciar oculto
    });

    const settings = app.getLoginItemSettings();
    console.log('[Main] Status final do auto-início:', settings.openAtLogin);
    return settings.openAtLogin;
  });

  ipcMain.handle('show-window', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true);
      setTimeout(() => mainWindow?.setAlwaysOnTop(false), 1000);
    }
  });

  // --- CLIPBOARD ---
  ipcMain.handle('write-clipboard', (event, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.handle('read-clipboard', () => {
    return clipboard.readText();
  });

  // --- LOGGING ---
  const LOG_FILE = join(app.getPath('userData'), 'mire_desk_logs.txt');
  ipcMain.handle('write-log', (event, text: string) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${text}\n`;
    try {
      fs.appendFileSync(LOG_FILE, logEntry);
    } catch (err) {
      console.error('Erro ao escrever no arquivo de log:', err);
    }
  });

  // --- FILE TRANSFER ---
  const TEMP_DIR = join(app.getPath('temp'), 'mire-desk');
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

  ipcMain.handle('read-file-chunk', async (event, filePath: string, start: number, size: number) => {
    try {
      const buffer = Buffer.alloc(size);
      const fd = fs.openSync(filePath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, size, start);
      fs.closeSync(fd);
      return buffer.subarray(0, bytesRead);
    } catch (err) {
      console.error('Erro ao ler chunk:', err);
      throw err;
    }
  });

  ipcMain.handle('save-file-chunk', async (event, transferId: string, chunk: Uint8Array) => {
    try {
      const tempFile = join(TEMP_DIR, transferId);
      fs.appendFileSync(tempFile, Buffer.from(chunk));
      return true;
    } catch (err) {
      console.error('Erro ao salvar chunk:', err);
      throw err;
    }
  });

  ipcMain.handle('finalize-file', async (event, transferId: string, fileName: string, x?: number, y?: number) => {
    try {
      let targetDir = join(app.getPath('downloads'), 'MiréDesk');

      // Se houver coordenadas, tentamos encontrar a pasta do Explorer sob o mouse
      if (x !== undefined && y !== undefined) {
        try {
          const { screen } = require('electron');
          const primaryDisplay = screen.getPrimaryDisplay();
          // Converte normalizado (0-1) para pixels reais
          const px = Math.floor(x * primaryDisplay.bounds.width);
          const py = Math.floor(y * primaryDisplay.bounds.height);

          const psScript = `
          Add-Type -TypeDefinition @'
          using System;
          using System.Runtime.InteropServices;
          public class Win32 {
              [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
              [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
          }
'@
          $shell = New-Object -ComObject Shell.Application
          $dropX = ${px}; $dropY = ${py}
          $foundPath = ""
          foreach($win in $shell.Windows()) {
              try {
                  $hwnd = [IntPtr]$win.HWND
                  $rect = New-Object Win32+RECT
                  if ([Win32]::GetWindowRect($hwnd, [ref]$rect)) {
                      if ($dropX -ge $rect.Left -and $dropX -le $rect.Right -and $dropY -ge $rect.Top -and $dropY -le $rect.Bottom) {
                          if ($win.Document.Folder.Self.Path) {
                              $foundPath = $win.Document.Folder.Self.Path
                              break
                          }
                      }
                  }
              } catch {}
          }
          if ($foundPath) { $foundPath } else { [Environment]::GetFolderPath('Desktop') }
        `;

          const { execSync } = require('child_process');
          const detectedPath = execSync(`powershell -Command "${psScript.replace(/"/g, '\"')}"`).toString().trim();
          if (detectedPath && fs.existsSync(detectedPath)) {
            targetDir = detectedPath;
          }
        } catch (e) {
          console.error('Falha ao detectar contexto de drop:', e);
        }
      }

      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

      const finalPath = join(targetDir, fileName);
      const tempFile = join(TEMP_DIR, transferId);

      fs.copyFileSync(tempFile, finalPath);
      fs.unlinkSync(tempFile);

      // Abre a pasta e seleciona o arquivo se for no Downloads, senão só notifica
      if (targetDir.includes('downloads')) {
        shell.showItemInFolder(finalPath);
      }

      return finalPath;
    } catch (err) {
      console.error('Erro ao finalizar arquivo:', err);
      throw err;
    }
  });

  ipcMain.handle('get-file-info', async (event, filePath: string) => {
    const stats = fs.statSync(filePath);
    return {
      name: path.basename(filePath),
      size: stats.size,
      path: filePath
    };
  });
}
