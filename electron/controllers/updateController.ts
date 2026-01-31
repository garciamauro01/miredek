import { app, ipcMain, shell } from 'electron';
import { join } from 'path';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { logToFile } from '../utils/logger';

export function setupUpdateHandlers() {
    ipcMain.handle('download-and-install-update', async (event, url: string) => {
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

            const totalLength = parseInt(response.headers['content-length'], 10);
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
}
