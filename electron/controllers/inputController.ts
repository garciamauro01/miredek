import { ipcMain, screen } from 'electron';
import { logToFile } from '../utils/logger';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let robot: any = null;

try {
    // Tenta carregar robotjs APENAS se estiver disponível (compilado corretamente)
    // Usa require dinâmico para evitar crash se a lib nativa falhar
    robot = require('robotjs');
    // Ajusta delay do mouse para 0 para ser mais fluido
    if (robot) robot.setMouseDelay(0);
} catch (e) {
    logToFile(`[Input] ERRO: Falha ao carregar robotjs. Controle remoto não funcionará. ${e}`);
}

export function setupInputHandlers() {
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
                    try {
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

    ipcMain.handle('move-mouse', (event, pos: { x: number | undefined, y: number | undefined }) => {
        if (pos && pos.x !== undefined && pos.y !== undefined) {
            const x = Math.round(pos.x);
            const y = Math.round(pos.y);
            try {
                if (robot) robot.moveMouse(x, y);
            } catch (e) {
                logToFile(`Erro robotjs moveMouse (${x},${y}): ${e}`);
            }
        }
    });
}
