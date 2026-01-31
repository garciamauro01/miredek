import { app } from 'electron';
import { join } from 'path';
import fs from 'fs';

const LOG_FILE = join(app.getPath('userData'), 'mire_desk_logs.txt');

export function logToFile(text: string) {
    const timestamp = new Date().toLocaleString();
    const entry = `[${timestamp}] ${text}\n`;
    try {
        console.log(text); // Mantém no console também
        fs.appendFileSync(LOG_FILE, entry);
    } catch (err) {
        console.error('Erro ao escrever log:', err);
    }
}
