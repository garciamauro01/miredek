import { app, ipcMain, BrowserWindow, clipboard, desktopCapturer } from 'electron';
import { logToFile } from '../utils/logger';
import { join } from 'path';
import { exec } from 'child_process';
import { existsSync } from 'fs';

const chatWindows = new Map<string, BrowserWindow>();
const sessionWindows = new Map<string, BrowserWindow>();
let debugWindow: BrowserWindow | null = null;

export function setupIpcHandlers(getMainWindow: () => BrowserWindow | null, preloadPath: string) {
    // --- IPC Handlers DevTools ---
    ipcMain.handle('open-devtools', () => {
        getMainWindow()?.webContents.openDevTools({ mode: 'detach' });
    });

    // --- IPC Handlers para Controles da Janela ---
    ipcMain.handle('window-minimize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        win?.minimize();
    });

    ipcMain.handle('window-maximize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win?.isMaximized()) {
            win.unmaximize();
        } else {
            win?.maximize();
        }
    });

    ipcMain.handle('window-close', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        win?.close();
    });

    ipcMain.handle('show-window', () => {
        const win = getMainWindow();
        if (win) {
            win.show();
            win.focus();
            win.setAlwaysOnTop(true);
            setTimeout(() => win?.setAlwaysOnTop(false), 1000);
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

    // --- ADMIN / ELEVATION ---
    ipcMain.handle('is-admin', async () => {
        try {
            // [FIX] is-admin is ESM, use dynamic import
            // @ts-ignore
            const { default: isAdmin } = await import('is-admin');
            return await isAdmin();
        } catch (e) {
            console.error('Falha ao verificar admin:', e);
            return false;
        }
    });

    ipcMain.handle('request-elevation', async (event, remoteId?: string) => {
        const sudo = require('sudo-prompt');
        const options = {
            name: 'MireDesk'
        };
        const exe = app.getPath('exe');

        // Se houver remoteId, passamos como flag para a nova instância auto-aceitar
        const args = remoteId ? `--accept-from=${remoteId}` : '';

        // No Windows, usar 'start' via cmd garante que o comando sudo retorne imediatamente
        // permitindo que o processo atual feche e libere o lock.
        const command = `cmd /c start "" "${exe}" ${args}`;

        logToFile(`[Elevation] Solicitando elevação: ${command}`);

        return new Promise((resolve, reject) => {
            // Libera o lock de instância única para que a nova instância (elevada) 
            // consiga iniciar mesmo que esta ainda não tenha terminado de fechar.
            try {
                app.releaseSingleInstanceLock();
            } catch (e) { }

            sudo.exec(command, options, (error: any) => {
                if (error) {
                    logToFile(`[Elevation] Erro: ${error}`);
                    // Tenta reaquistar o lock se deu erro na elevação (opcional)
                    app.requestSingleInstanceLock();
                    reject(error);
                } else {
                    logToFile(`[Elevation] Sucesso no comando. Encerrando instância atual.`);
                    // Sair o mais rápido possível para garantir que o lock seja liberado no SO
                    app.exit(0);
                    resolve(true);
                }
            });
        });
    });

    ipcMain.handle('get-command-line-args', () => {
        return process.argv;
    });

    ipcMain.handle('get-machine-id', async () => {
        const idPath = require('path').join(app.getPath('userData'), 'peer-id.txt');
        const fs = require('fs');

        try {
            if (fs.existsSync(idPath)) {
                const id = fs.readFileSync(idPath, 'utf8').trim();
                if (id && id.length === 9) return id;
            }
        } catch (e) {
            logToFile(`[ID] Erro ao ler ID persistente: ${e}`);
        }

        // Se não existir ou for inválido, gera um novo
        const newId = Math.floor(100000000 + Math.random() * 900000000).toString();
        try {
            fs.writeFileSync(idPath, newId, 'utf8');
            logToFile(`[ID] Novo ID gerado e persistido: ${newId}`);
        } catch (e) {
            logToFile(`[ID] Erro ao salvar novo ID: ${e}`);
        }

        return newId;
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

    // Manipulador para obter as fontes de tela
    const { screen } = require('electron');
    ipcMain.handle('get-sources', async () => {
        try {
            const sources = await desktopCapturer.getSources({ types: ['screen'] });
            const displays = screen.getAllDisplays();
            const primaryDisplay = screen.getPrimaryDisplay();

            return sources.map((source) => {
                // Tenta encontrar o display correspondente via display_id ou nome
                const display = displays.find((d: any) => d.id.toString() === source.display_id) ||
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

    // --- MULTI-WINDOW SESSION ---
    ipcMain.handle('open-session-window', (event, sessionId: string, remoteId: string) => {
        if (sessionWindows.has(sessionId)) {
            const win = sessionWindows.get(sessionId);
            win?.show();
            win?.focus();
            return;
        }

        const sessionWin = new BrowserWindow({
            width: 1000,
            height: 800,
            frame: false,
            titleBarStyle: 'hidden',
            backgroundColor: '#000000',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: preloadPath,
            },
        });

        sessionWindows.set(sessionId, sessionWin);

        const url = process.env.VITE_DEV_SERVER_URL
            ? `${process.env.VITE_DEV_SERVER_URL}?view=session&sessionId=${sessionId}&remoteId=${remoteId}`
            : `file://${require('path').join(app.getAppPath(), 'dist/index.html')}?view=session&sessionId=${sessionId}&remoteId=${remoteId}`;

        sessionWin.loadURL(url);

        sessionWin.on('closed', () => {
            sessionWindows.delete(sessionId);
        });
    });

    // --- MULTI-WINDOW CHAT ---
    ipcMain.handle('open-chat-window', (event, sessionId: string, remoteId: string) => {
        if (chatWindows.has(sessionId)) {
            const win = chatWindows.get(sessionId);
            win?.show();
            win?.focus();
            return;
        }

        const chatWin = new BrowserWindow({
            width: 400,
            height: 500,
            frame: false,
            titleBarStyle: 'hidden',
            backgroundColor: '#ffffff',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: preloadPath,
            },
        });

        chatWindows.set(sessionId, chatWin);

        const url = process.env.VITE_DEV_SERVER_URL
            ? `${process.env.VITE_DEV_SERVER_URL}?view=chat&sessionId=${sessionId}&remoteId=${remoteId}`
            : `file://${require('path').join(app.getAppPath(), 'dist/index.html')}?view=chat&sessionId=${sessionId}&remoteId=${remoteId}`;

        chatWin.loadURL(url);

        chatWin.on('closed', () => {
            chatWindows.delete(sessionId);
        });
    });

    ipcMain.handle('chat-notify-received', (event, sessionId: string, message: any) => {
        const win = chatWindows.get(sessionId);
        if (win) {
            win.webContents.send('chat-message-received', message);
        }
    });

    ipcMain.handle('chat-send-from-window', (event, sessionId: string, message: any) => {
        const mainWin = getMainWindow();
        if (mainWin) {
            mainWin.webContents.send('chat-message-outgoing', sessionId, message);
        }
    });

    // --- DEBUG ---
    ipcMain.handle('open-debug-window', () => {
        if (debugWindow) {
            debugWindow.show();
            debugWindow.focus();
            return;
        }

        debugWindow = new BrowserWindow({
            width: 500,
            height: 400,
            frame: false,
            titleBarStyle: 'hidden',
            backgroundColor: '#1e1e1e',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: preloadPath,
            },
        });

        const url = process.env.VITE_DEV_SERVER_URL
            ? `${process.env.VITE_DEV_SERVER_URL}?view=debug`
            : `file://${require('path').join(app.getAppPath(), 'dist/index.html')}?view=debug`;

        debugWindow.loadURL(url);

        debugWindow.on('closed', () => {
            debugWindow = null;
        });
    });

    ipcMain.handle('debug-notify-event', (event, data: any) => {
        if (debugWindow) {
            debugWindow.webContents.send('debug-event-received', data);
        }
    });

    // --- HTTP PROXY (Bypass CORS) ---
    ipcMain.handle('check-server-peers', async (event, url: string) => {
        try {
            console.log(`[HTTP Proxy] Fetching: ${url}`);
            const response = await fetch(url);
            console.log(`[HTTP Proxy] Response status: ${response.status}`);
            if (response.ok) {
                const json = await response.json();
                console.log(`[HTTP Proxy] Success. Peers count: ${json.length}`);
                return json; // Return the array
            }
            return null;
        } catch (e) {
            console.error(`[HTTP Proxy] Error fetching ${url}:`, e);
            logToFile(`[HTTP Proxy] Falha ao consultar peers em ${url}: ${e}`);
            return null;
        }
    });

    // --- SERVICE MANAGEMENT ---
    const getServicePath = () => {
        const binName = 'MireDeskService.exe';
        if (app.isPackaged) {
            // In production, binaries are in 'resources/bin' due to extraResources config
            return join(process.resourcesPath, 'bin', binName);
        } else {
            // In development, they are in the source directory (root of native_service)
            return join(app.getAppPath(), 'native_service', binName);
        }
    };

    ipcMain.handle('install-service', async () => {
        const servicePath = getServicePath();
        logToFile(`[Service] Instalando serviço de: ${servicePath}`);

        if (!existsSync(servicePath)) {
            const err = `Binário do serviço não encontrado em: ${servicePath}`;
            logToFile(`[Service] Erro: ${err}`);
            throw new Error(err);
        }

        return new Promise((resolve, reject) => {
            exec(`"${servicePath}" /install`, (error, stdout, stderr) => {
                if (error) {
                    logToFile(`[Service] Erro ao instalar: ${error.message}`);
                    reject(error);
                } else {
                    logToFile(`[Service] Instalação concluída: ${stdout}`);
                    // Start service after installation
                    exec(`net start MireDeskService`, (e) => {
                        if (e) logToFile(`[Service] Aviso ao iniciar: ${e.message}`);
                        resolve(true);
                    });
                }
            });
        });
    });

    ipcMain.handle('uninstall-service', async () => {
        const servicePath = getServicePath();
        logToFile(`[Service] Desinstalando serviço...`);

        return new Promise((resolve, reject) => {
            // Try to stop first
            exec(`net stop MireDeskService`, () => {
                exec(`"${servicePath}" /uninstall`, (error, stdout, stderr) => {
                    if (error) {
                        logToFile(`[Service] Erro ao desinstalar: ${error.message}`);
                        reject(error);
                    } else {
                        logToFile(`[Service] Desinstalação concluída: ${stdout}`);
                        resolve(true);
                    }
                });
            });
        });
    });

    ipcMain.handle('get-service-status', async () => {
        return new Promise((resolve) => {
            exec('sc query MireDeskService', (error, stdout) => {
                if (error || stdout.includes('1  STOPPED') || stdout.includes('1060')) {
                    resolve('stopped');
                } else if (stdout.includes('4  RUNNING')) {
                    resolve('running');
                } else {
                    resolve('not-installed');
                }
            });
        });
    });
}

export function sendToDebugWindow(data: any) {
    if (debugWindow) {
        debugWindow.webContents.send('debug-event-received', data);
    }
}
