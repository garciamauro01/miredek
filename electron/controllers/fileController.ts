import { app, ipcMain, shell } from 'electron';
import { join } from 'path';
import fs from 'fs';
import path from 'path';
import { logToFile } from '../utils/logger';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const TEMP_DIR = join(app.getPath('temp'), 'mire-desk');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

export function setupFileHandlers() {
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
                const px = Math.floor((x || 0) * primaryDisplay.bounds.width);
                const py = Math.floor((y || 0) * primaryDisplay.bounds.height);

                logToFile(`[Main] Detectando drop. Norm: (${(x || 0).toFixed(2)}, ${(y || 0).toFixed(2)}) -> Px: (${px}, ${py})`);

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
}
