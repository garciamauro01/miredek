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
    ipcMain.on('execute-input', async (event, data) => {
        if (!robot && !process.argv.includes('--service')) return;

        try {
            const { type } = data;
            const primaryDisplay = screen.getPrimaryDisplay();
            const bounds = data.activeSourceBounds || primaryDisplay.bounds;

            const isService = process.argv.includes('--service');

            const forwardToNativeAgent = async () => {
                const params = new URLSearchParams();
                params.append('type', type);

                if (type === 'mousemove' || type === 'mousedown' || type === 'mouseup') {
                    const x = Math.round(bounds.x + (data.x * bounds.width));
                    const y = Math.round(bounds.y + (data.y * bounds.height));
                    params.append('x', x.toString());
                    params.append('y', y.toString());
                    if (data.button !== undefined) {
                        const btnMap: any = { 'left': 0, 'middle': 1, 'right': 2 };
                        params.append('button', btnMap[data.button]?.toString() || '0');
                    }
                } else if (type === 'mousewheel') {
                    params.append('deltaY', data.deltaY.toString());
                } else if (type === 'keydown' || type === 'keyup') {
                    const vk = data.keyCode || 0;
                    if (vk > 0) params.append('key', vk.toString());
                    else return false; // Don't try if no VK
                }

                try {
                    const res = await fetch(`http://localhost:9876/input?${params.toString()}`, { signal: AbortSignal.timeout(500) });
                    return res.ok;
                } catch (err) {
                    return false;
                }
            };

            if (isService) {
                await forwardToNativeAgent();
                return;
            }

            // Performance: For mousemove in non-service mode, we prefer robotjs for low latency
            // but for clicks and keys, we try the Agent first to support UAC prompts.
            if (type !== 'mousemove') {
                const handled = await forwardToNativeAgent();
                if (handled) return;
            }

            // --- Standard RobotJS logic (User mode) ---
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
                    try {
                        const rawDeltaY = data.deltaY;
                        const scrollAmount = Math.round(data.deltaY / 2);
                        const magnitude = Math.abs(scrollAmount);

                        if (magnitude === 0 && Math.abs(rawDeltaY) > 0) {
                            robot.scrollMouse(0, rawDeltaY > 0 ? 1 : -1);
                            break;
                        }

                        robot.scrollMouse(0, scrollAmount > 0 ? magnitude : -magnitude);
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
