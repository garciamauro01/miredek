import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import fs from 'fs';
import path from 'path';
import { logToFile } from './utils/logger';
import { setupInputHandlers } from './controllers/inputController';
import { setupFileHandlers } from './controllers/fileController';
import { setupUpdateHandlers } from './controllers/updateController';
import { setupIpcHandlers } from './controllers/ipcController';
import { createTray } from './controllers/trayController';

// --- LOGGING ---
const LOG_FILE = join(app.getPath('userData'), 'mire_desk_logs.txt');
// (A função logToFile já foi extraída, mas o LOG_FILE aqui é usado apenas para referência se precisar,
// mas o logger.ts já cuida disso. Apenas logamos o início.)

logToFile(`[Main] === INICIANDO APP (Packaged: ${app.isPackaged}) ===`);
logToFile(`[Main] Executável: ${app.getPath('exe')}`);

// --- BLOQUEIO DE ÚNICA INSTÂNCIA ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Main] Já existe uma instância rodando. Encerrando esta.');
  app.quit();
} else {
  let mainWindow: BrowserWindow | null = null;

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // --- CONFIGURAÇÃO DE REDE E WEBRTC ---
  app.commandLine.appendSwitch('disable-features', 'WidgetLayering,WebRtcHideLocalIpsWithMdns,WebRTC-HideLocalIpsWithMdns');
  app.commandLine.appendSwitch('webrtc-ip-handling-policy', 'default_public_and_private_interfaces');
  app.commandLine.appendSwitch('enforce-webrtc-ip-permission-check');
  app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'default_public_and_private_interfaces');
  app.commandLine.appendSwitch('enable-features', 'WebRtcAllowInputVolumeAdjustment');
  app.commandLine.appendSwitch('disable-mdns-fallback-on-name-resolution-failure');

  let isQuitting = false;

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
      show: false,
      backgroundColor: '#ffffff',
      frame: false,
      titleBarStyle: 'hidden',
      icon: iconPath,
      minimizable: true,
      maximizable: true,
      closable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, 'preload.js'),
        devTools: !app.isPackaged,
      },
    });

    mainWindow.setMenu(null);

    // Debug events
    mainWindow.on('minimize', () => console.log('[Main] Janela minimizada'));
    mainWindow.on('maximize', () => console.log('[Main] Janela maximizada'));
    mainWindow.on('restore', () => console.log('[Main] Janela restaurada'));
    mainWindow.on('show', () => console.log('[Main] Janela mostrada'));
    mainWindow.on('hide', () => console.log('[Main] Janela ocultada'));

    console.log('Caminho do Preload:', join(__dirname, 'preload.js'));

    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    if (process.env.VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      const appPath = app.getAppPath();
      const possiblePaths = [
        join(__dirname, 'index.html'),
        join(__dirname, '../dist/index.html'),
        join(appPath, 'dist/index.html'),
        join(appPath, 'index.html'),
        path.join(process.resourcesPath, 'app/dist/index.html'),
        path.join(process.resourcesPath, 'app.asar/dist/index.html')
      ];

      let loaded = false;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          logToFile(`[Main] Sucesso: Arquivo encontrado em ${p}. Carregando...`);
          mainWindow.loadFile(p);
          loaded = true;
          break;
        }
      }

      if (!loaded) {
        logToFile(`[Main] ERRO CRÍTICO: Nenhum index.html encontrado.`);
      }
    }

    // DevTools Shortcut (F12)
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') {
        mainWindow?.webContents.toggleDevTools();
        event.preventDefault();
      }
      if (input.key === 'r' && input.control && input.type === 'keyDown') {
        mainWindow?.reload();
        event.preventDefault();
      }
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

  app.whenReady().then(() => {
    createWindow();
    createTray(mainWindow, !app.isPackaged, process.resourcesPath);

    // Configura auto-início na primeira execução
    if (app.isPackaged) {
      try {
        const userDataPath = app.getPath('userData');
        const flagFile = join(userDataPath, '.first_run_done');

        if (!fs.existsSync(flagFile)) {
          logToFile('[Main] Primeira execução detectada. Configurando auto-início...');
          const exePath = app.getPath('exe');
          app.setLoginItemSettings({ openAtLogin: true, path: exePath, args: ['--hidden'] });
          fs.writeFileSync(flagFile, new Date().toISOString());
        }
      } catch (e) {
        logToFile(`[Main] Erro ao configurar auto-início: ${e}`);
      }
    }

    // Inicializa Controladores
    setupInputHandlers();
    setupFileHandlers();
    setupUpdateHandlers();
    setupIpcHandlers(() => mainWindow);

    try {
      const robot = require('robotjs');
      logToFile(`[Main] Sistema de input carregado com sucesso. RobotJS disponível: ${!!robot}`);
    } catch (e) {
      logToFile(`[Main] ERRO: Falha ao carregar RobotJS no processo principal: ${e}`);
    }
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      if (isQuitting) app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
