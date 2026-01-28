import { useState, useEffect } from 'react';

interface UpdateInfo {
    version: string;
    critical: boolean;
    downloadUrl: string;
    releaseNotes: string;
}

export function useUpdateCheck(serverIp: string) {
    const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
    const [currentVersion, setCurrentVersion] = useState<string>('');

    useEffect(() => {
        // Obtém versão atual via Electron
        if (window.electronAPI) {
            window.electronAPI.getAppVersion().then((ver) => {
                console.log('[UpdateCheck] Versão atual:', ver);
                setCurrentVersion(ver);
            });
        }

        const checkUpdate = async () => {
            try {
                // Assume que o servidor de sinalização também serve a versão na porta 3001 (ou ajustada)
                // Se serverIp for apenas IP (ex: 192.168.1.5), adicionamos protocolo e porta padrão
                let url = serverIp;
                if (!url.startsWith('http')) {
                    url = `http://${serverIp}:3001/version`; // Porta padrão do server socket.io
                } else {
                    // Se já tiver http, assume que está completo ou ajusta
                    url = `${url.replace(/\/$/, '')}/version`;
                }

                // Em dev, pode ser localhost:3001 se serverIp não estiver setado
                if (!serverIp) url = 'http://localhost:3001/version';

                console.log('[UpdateCheck] Verificando update em:', url);

                const res = await fetch(url);
                if (res.ok) {
                    const info: UpdateInfo = await res.json();

                    // Smart URL: se for relativa, anexa ao servidor base
                    if (info.downloadUrl.startsWith('/')) {
                        const baseUrl = url.replace('/version', '');
                        info.downloadUrl = `${baseUrl}${info.downloadUrl}`;
                    }

                    console.log('[UpdateCheck] Info remota processada:', info);

                    if (window.electronAPI) {
                        const current = await window.electronAPI.getAppVersion();
                        console.log('[UpdateCheck] Comparando versões - Atual:', current, 'Servidor:', info.version);

                        // Comparação simples de string (ideal seria semver)
                        if (info.version !== current) {
                            console.log('[UpdateCheck] ✅ Nova versão disponível!');
                            setUpdateAvailable(info);
                        } else {
                            console.log('[UpdateCheck] ℹ️ App já está na versão mais recente');
                        }
                    }
                }
            } catch (err) {
                console.error('[UpdateCheck] Falha ao verificar update:', err);
            }
        };

        // Check imediato e depois a cada 2min (para testes - depois pode aumentar)
        checkUpdate();
        const interval = setInterval(checkUpdate, 2 * 60 * 1000); // 2 minutos

        return () => clearInterval(interval);
    }, [serverIp]);

    return { updateAvailable, currentVersion };
}
