import { app, Menu, Tray, nativeImage, BrowserWindow } from 'electron';
import { join } from 'path';

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow | null, isDev: boolean, resourcesPath: string) {
    try {
        const iconPath = !isDev
            ? join(resourcesPath, 'icon.png') // Caminho no build
            : join(__dirname, '../public/icon.png'); // Caminho no dev - Ajustado para estrutura de pastas nova

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
        return tray;
    } catch (err) {
        console.error('[Main] Erro fatal ao criar Tray:', err);
        return null;
    }
}
