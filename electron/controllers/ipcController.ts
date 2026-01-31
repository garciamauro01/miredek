import { app, ipcMain, BrowserWindow, clipboard, desktopCapturer } from 'electron';
import { logToFile } from '../utils/logger';

export function setupIpcHandlers(getMainWindow: () => BrowserWindow | null) {
    // --- IPC Handlers DevTools ---
    ipcMain.handle('open-devtools', () => {
        getMainWindow()?.webContents.openDevTools({ mode: 'detach' });
    });

    // --- IPC Handlers para Controles da Janela ---
    ipcMain.handle('window-minimize', () => {
        getMainWindow()?.minimize();
    });

    ipcMain.handle('window-maximize', () => {
        const win = getMainWindow();
        if (win?.isMaximized()) {
            win.unmaximize();
        } else {
            win?.maximize();
        }
    });

    ipcMain.handle('window-close', () => {
        getMainWindow()?.close();
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
}
