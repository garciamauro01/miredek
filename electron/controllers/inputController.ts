import { ipcMain, screen } from 'electron';
import { logToFile } from '../utils/logger';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let robot: any = null;

try {
    robot = require('@jitsi/robotjs');
    if (robot) {
        robot.setMouseDelay(0);
        const { width, height } = robot.getScreenSize();
        logToFile(`[Input] RobotJS carregado com sucesso (${width}x${height}).`);
    }
} catch (e) {
    logToFile(`[Input] ERRO: Falha ao carregar @jitsi/robotjs: ${e}`);
}

export function setupInputHandlers() {
    ipcMain.on('execute-input', (event, data) => {
        if (!robot) return;

        try {
            const { type } = data;
            const primaryDisplay = screen.getPrimaryDisplay();
            const bounds = data.activeSourceBounds || primaryDisplay.bounds;

            switch (type) {
                case 'mousemove':
                    const x = Math.round(bounds.x + (data.x * bounds.width));
                    const y = Math.round(bounds.y + (data.y * bounds.height));

                    if (isNaN(x) || isNaN(y)) return;

                    try {
                        robot.moveMouse(x, y);
                    } catch (err) { }
                    break;

                case 'mousedown': {
                    const x = Math.round(bounds.x + (data.x * bounds.width));
                    const y = Math.round(bounds.y + (data.y * bounds.height));
                    logToFile(`[Input] Click DOWN em: ${x}, ${y}`);
                    robot.moveMouse(x, y);
                    robot.mouseToggle('down', data.button);
                    break;
                }

                case 'mouseup': {
                    const x = Math.round(bounds.x + (data.x * bounds.width));
                    const y = Math.round(bounds.y + (data.y * bounds.height));
                    logToFile(`[Input] Click UP em: ${x}, ${y}`);
                    robot.moveMouse(x, y);
                    robot.mouseToggle('up', data.button);
                    break;
                }

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

                case 'mousewheel': {
                    // Scroll do mouse (roda)
                    // deltaY > 0 = scroll para baixo, deltaY < 0 = scroll para cima
                    // deltaX > 0 = scroll para direita, deltaX < 0 = scroll para esquerda
                    try {
                        const rawDeltaY = data.deltaY;
                        const scrollAmount = Math.round(data.deltaY / 2); // Ajustar sensibilidade (Menor divisor = Mais rápido)
                        const direction = scrollAmount > 0 ? 'down' : 'up';
                        const magnitude = Math.abs(scrollAmount);

                        if (magnitude === 0) {
                            // [FIX] Força scroll mínimo de 1 se houver movimento (para touchpads precisos)
                            if (Math.abs(rawDeltaY) > 0) {
                                const minScroll = rawDeltaY > 0 ? 1 : -1;
                                robot.scrollMouse(0, minScroll > 0 ? 1 : -1);
                                break;
                            }
                        }

                        // robotjs.scrollMouse(x, y) onde y é a quantidade de scroll vertical
                        robot.scrollMouse(0, scrollAmount > 0 ? magnitude : -magnitude);

                        logToFile(`[Input] Scroll ${direction} magnitude: ${magnitude}`);
                    } catch (err) {
                        console.error('Erro ao executar scroll:', err);
                    }
                    break;
                }
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

    ipcMain.handle('reset-input', () => {
        if (!robot) return;
        try {
            console.log('[Input-Electron] Resetando estado do input (segurança)...');
            // Solta botões do mouse
            robot.mouseToggle('up', 'left');
            robot.mouseToggle('up', 'right');
            robot.mouseToggle('up', 'middle');

            // Solta teclas de modificação comuns
            const modifiers = ['control', 'shift', 'alt', 'command'];
            modifiers.forEach(key => {
                try { robot.keyToggle(key, 'up'); } catch (e) { }
            });
        } catch (e) {
            console.error('[Input-Electron] Erro ao resetar input:', e);
        }
    });
}
