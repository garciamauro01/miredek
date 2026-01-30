import { app, BrowserWindow, desktopCapturer, ipcMain, session, Tray, Menu, nativeImage, clipboard, shell } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- LOGGING ---
const LOG_FILE = join(app.getPath('userData'), 'mire_desk_logs.txt');

function logToFile(text: string) {
  const timestamp = new Date().toLocaleString();
  const entry = `[${timestamp}] ${text}\n`;
  try {
    console.log(text); // Mantém no console também
    fs.appendFileSync(LOG_FILE, entry);
  } catch (err) {
    console.error('Erro ao escrever log:', err);
  }
}

// Log inicial obrigatório
logToFile(`[Main] === INICIANDO APP (Packaged: ${app.isPackaged}) ===`);
logToFile(`[Main] Executável: ${app.getPath('exe')}`);
logToFile(`[Main] __dirname: ${__dirname}`);

process.on('uncaughtException', (err) => {
  logToFile(`[Main] CRASH (uncaughtException): ${err.message}\n${err.stack}`);
});

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
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'icon.png')
      : join(__dirname, '../public/icon.png');

    mainWindow = new BrowserWindow({
      width: 1000,
      height: 800,
      center: true,
      show: false, // Não mostrar até estar pronta
      backgroundColor: '#ffffff', // Cor de fundo inicial para evitar flash branco
      frame: false, // Janela sem bordas (frameless)
      titleBarStyle: 'hidden', // Oculta barra de título nativa mas mantém comportamento de snap
      icon: iconPath,
      minimizable: true,
      maximizable: true,
      closable: true,
      alwaysOnTop: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, 'preload.js'),
        devTools: !app.isPackaged, // Desabilitar em produção
      },
    });

    // Remove o menu padrão (File, Edit, etc)
    mainWindow.setMenu(null);

    // Debug events
    mainWindow.on('minimize', () => console.log('[Main] Janela minimizada'));
    mainWindow.on('maximize', () => console.log('[Main] Janela maximizada'));
    mainWindow.on('restore', () => console.log('[Main] Janela restaurada'));
    mainWindow.on('show', () => console.log('[Main] Janela mostrada'));
    mainWindow.on('hide', () => console.log('[Main] Janela ocultada'));

    console.log('Caminho do Preload:', join(__dirname, 'preload.js'));

    const appPath = app.getAppPath();
    logToFile(`[Main] app.getAppPath(): ${appPath}`);

    if (process.env.VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      // Tenta caminhos comuns em apps empacotados
      const possiblePaths = [
        join(__dirname, 'index.html'),           // Caso o vite-plugin-electron coloque na raiz do dist-electron
        join(__dirname, '../dist/index.html'),   // Estrutura padrão
        join(appPath, 'dist/index.html'),        // Estrutura alternativa
        join(appPath, 'index.html'),             // Estrutura alternativa 2
        path.join(process.resourcesPath, 'app/dist/index.html'), // asar unpacked ou asar structure
        path.join(process.resourcesPath, 'app.asar/dist/index.html')
      ];

      let loaded = false;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          logToFile(`[Main] Sucesso: Arquivo encontrado em ${p}. Carregando...`);
          mainWindow.loadFile(p);
          loaded = true;
          break;
        } else {
          logToFile(`[Main] Info: Arquivo não encontrado em ${p}`);
        }
      }

      if (!loaded) {
        logToFile(`[Main] ERRO CRÍTICO: Nenhum index.html encontrado em nenhum dos caminhos testados.`);
      }
    }

    mainWindow.webContents.on('did-finish-load', () => {
      logToFile('[Main] webContents: did-finish-load');
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      logToFile(`[Main] FALHA ao carregar URL: ${validatedURL} | Erro: ${errorCode} (${errorDescription})`);
    });

    mainWindow.webContents.on('render-process-gone', (event, details) => {
      logToFile(`[Main] PROCESSO DE RENDERIZAÇÃO CAIU: ${details.reason} (${details.exitCode})`);
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

    // --- IPC Handlers para Controles da Janela ---
    ipcMain.handle('window-minimize', () => {
      mainWindow?.minimize();
    });

    ipcMain.handle('window-maximize', () => {
      if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow?.maximize();
      }
    });

    ipcMain.handle('window-close', () => {
      mainWindow?.close();
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
      logToFile(`[Main] Erro fatal ao capturar fontes: ${error}`);
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
    logToFile(`[Main] ERRO: Falha ao carregar robotjs. Controle remoto não funcionará. ${e}`);
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
          const x = bounds.x + (data.x * bounds.width);
          const y = bounds.y + (data.y * bounds.height);
          // Reduz log de movimento para não spammar
          // if (Math.random() > 0.95) console.log(`[Input] Move: ${x|0}, ${y|0}`);
          robot.moveMouse(x, y);
          break;

        case 'mousedown':
          console.log(`[Input] Click DOWN em: ${data.x.toFixed(2)}, ${data.y.toFixed(2)} (Tela: ${bounds.x},${bounds.y})`);
          robot.mouseToggle('down', data.button);
          break;

        case 'mouseup':
          console.log(`[Input] Click UP em: ${data.x.toFixed(2)}, ${data.y.toFixed(2)}`);
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
    logToFile(`[Main] Configurando auto-início para: ${value}`);
    const exePath = app.getPath('exe');
    logToFile(`[Main] Caminho do executável para auto-início: ${exePath}`);

    app.setLoginItemSettings({
      openAtLogin: value,
      path: exePath,
      args: ['--hidden'] // Sugestão: iniciar oculto
    });

    const settings = app.getLoginItemSettings();
    logToFile(`[Main] Status final do auto-início: ${settings.openAtLogin}`);
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

  ipcMain.handle('write-log', (event, text: string) => {
    logToFile(text);
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
      // ==================================================================================
      // ⚠️ CRITICAL - DO NOT CHANGE THIS BEHAVIOR ⚠️
      // O usuário requer que o arquivo seja salvo EXATAMENTE onde foi solto (Desktop, Pasta, etc).
      // Esta lógica usa PowerShell para detectar a janela sob o mouse.
      // Se falhar, usa o Desktop/Downloads como fallback, mas a TENTATIVA é obrigatória.
      // NÃO REMOVA OU SIMPLIFIQUE ESTA LÓGICA DE DETECÇÃO.
      // ==================================================================================
      try {
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        // Converte normalizado (0-1) para pixels reais
        const px = Math.floor(x * primaryDisplay.bounds.width);
        const py = Math.floor(y * primaryDisplay.bounds.height);

        logToFile(`[Main] Detectando drop. Norm: (${x.toFixed(2)}, ${y.toFixed(2)}) -> Px: (${px}, ${py})`);

        const psScript = `
          $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
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
          
          if ($foundPath) { 
              Write-Output $foundPath 
          } else { 
              # Se não achou janela, tenta verificar se está no Desktop (área livre)
              Write-Output ([Environment]::GetFolderPath('Desktop'))
          }
        `;

        const { execSync } = require('child_process');
        // Adiciona timeout para não travar
        let detectedPath = "";
        try {
          detectedPath = execSync(`powershell -NoProfile -InputFormat None -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\"')}"`, { timeout: 10000, encoding: 'utf-8' }).toString().trim();
          logToFile(`[Main] PowerShell detectou: "${detectedPath}"`);
        } catch (psError: any) {
          logToFile(`[Main] Erro na execução do PowerShell: ${psError.message}`);
          if (psError.stderr) logToFile(`[Main] PowerShell STDERR: ${psError.stderr}`);
        }

        logToFile(`[Main] Caminho final detectado: ${detectedPath}`);

        if (detectedPath && fs.existsSync(detectedPath)) {
          targetDir = detectedPath;
        } else {
          logToFile(`[Main] Caminho detectado falhou ("${detectedPath}"). Usando fallback seguro: Downloads/MiréDesk`);
        }
      } catch (e) {
        console.error('Falha ao detectar contexto de drop (usando fallback):', e);
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

  // --- AUTO UPDATE: DOWNLOAD AND INSTALL ---
  ipcMain.handle('download-and-install-update', async (event, url: string) => {
    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');
    const { shell } = require('electron');
    const tempDir = app.getPath('temp');
    // Usa um timestamp para evitar o erro EBUSY se o arquivo anterior ainda estiver travado ou em uso
    const targetPath = path.join(tempDir, `MireDesk-Update-${Date.now()}.exe`);

    logToFile(`[Update] Iniciando download via Axios de: ${url} para ${targetPath}`);

    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
      });

      const totalLength = response.headers['content-length'];
      let downloadedLength = 0;

      response.data.on('data', (chunk: any) => {
        downloadedLength += chunk.length;
        if (totalLength) {
          const progress = Math.round((downloadedLength / totalLength) * 100);
          event.sender.send('update-progress', progress);
        }
      });

      const writer = fs.createWriteStream(targetPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', async () => {
          logToFile('[Update] Download concluído com sucesso.');
          event.sender.send('update-progress', 100);
          try {
            await shell.openPath(targetPath);
            app.quit();
            resolve(true);
          } catch (e) {
            reject(e);
          }
        });
        writer.on('error', reject);
      });
    } catch (error) {
      logToFile(`[Update] Erro fatal no download: ${error}`);
      throw error;
    }
  });

  // Novo: Move o mouse para uma posição específica
  ipcMain.handle('move-mouse', (event, pos: { x: number | undefined, y: number | undefined }) => {
    if (pos && pos.x !== undefined && pos.y !== undefined) {
      const x = Math.round(pos.x);
      const y = Math.round(pos.y);
      try {
        robot.moveMouse(x, y);
      } catch (e) {
        logToFile(`Erro robotjs moveMouse (${x},${y}): ${e}`);
      }
    }
  });

  // Novo: Verifica se o app está instalado (NSIS) ou rodando como Portátil
  ipcMain.handle('is-app-installed', () => {
    // Se estiver em modo dev, retorna false para mostrar o banner de instalação
    if (!app.isPackaged) return false;

    const exePath = app.getPath('exe').toLowerCase();
    const localAppData = (process.env.LOCALAPPDATA || '').toLowerCase();
    const programFiles = (process.env.PROGRAMFILES || 'c:\\program files').toLowerCase();
    const programFilesX86 = (process.env['PROGRAMFILES(X86)'] || 'c:\\program files (x86)').toLowerCase();

    // Verifica se o executável está em pastas típicas de instalação
    const isInstalled =
      (localAppData && exePath.includes(localAppData)) ||
      exePath.includes('program files') ||
      exePath.includes('arquivos de programas') || // Windows em Português
      exePath.includes(programFiles) ||
      exePath.includes(programFilesX86);

    logToFile(`[Check] Detecção de Instalação:`);
    logToFile(` - Executável: ${exePath}`);
    logToFile(` - LocalAppData: ${localAppData}`);
    logToFile(` - ProgramFiles: ${programFiles}`);
    logToFile(` - Instalado: ${isInstalled}`);

    return isInstalled;
  });

  // Novo: Obtém o endereço IP local da máquina
  ipcMain.handle('get-local-ip', () => {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    let localIp = '127.0.0.1';

    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        // Pula endereços internos (loopback) e não IPv4
        if (net.family === 'IPv4' && !net.internal) {
          localIp = net.address;
          break;
        }
      }
      if (localIp !== '127.0.0.1') break;
    }
    return localIp;
  });
}
