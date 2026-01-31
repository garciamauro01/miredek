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
                // Monta URL com Cache Busting para evitar leituras antigas
                let baseUrl = serverIp;
                if (baseUrl === 'cloud') {
                    baseUrl = '167.234.241.147';
                }

                if (!baseUrl.startsWith('http')) {
                    baseUrl = `http://${baseUrl}:3001`;
                }
                baseUrl = baseUrl.replace(/\/$/, ''); // Remove barra final se houver

                const url = `${baseUrl}/version?t=${Date.now()}`; // Cache busting
                console.log(`[UpdateCheck] Iniciando verificação em: ${url}`);

                const res = await fetch(url);
                console.log(`[UpdateCheck] Status da resposta: ${res.status}`);

                if (!res.ok) {
                    throw new Error(`Servidor respondeu com status ${res.status}`);
                }

                const text = await res.text();
                // console.log('[UpdateCheck] Payload recebido:', text);

                let info: UpdateInfo;
                try {
                    info = JSON.parse(text);
                } catch (e) {
                    throw new Error(`Resposta inválida (não é JSON): ${text.substring(0, 100)}...`);
                }

                // Normaliza URL de download se for relativa
                if (info.downloadUrl.startsWith('/')) {
                    info.downloadUrl = `${baseUrl}${info.downloadUrl}`;
                }

                console.log('[UpdateCheck] Versão no Servidor:', info.version);

                if (window.electronAPI) {
                    const current = await window.electronAPI.getAppVersion();
                    console.log(`[UpdateCheck] Comparativo: App [${current}] vs Server [${info.version}]`);

                    // Normaliza versões para comparação (semantica simples)
                    if (info.version.trim() !== current.trim()) {
                        console.log('[UpdateCheck] ✅ DIFERENÇA DETECTADA -> Atualização Disponível!');
                        setUpdateAvailable(info);
                    } else {
                        console.log('[UpdateCheck] ℹ️ Versões iguais. Nenhuma ação necessária.');
                    }
                }
            } catch (err: any) {
                // Silencie network errors para não alarmar o usuário, apenas log warning
                if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
                    console.warn('[UpdateCheck] Não foi possível contatar o servidor de atualizações (pode estar offline).');
                } else {
                    console.error('[UpdateCheck] Falha na verificação:', err.message);
                }
            }
        };

        // Check imediato e depois a cada 2min (para testes - depois pode aumentar)
        checkUpdate();
        const interval = setInterval(checkUpdate, 2 * 60 * 1000); // 2 minutos

        return () => clearInterval(interval);
    }, [serverIp]);

    return { updateAvailable, currentVersion };
}
