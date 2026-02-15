import { useState, useEffect, useRef } from 'react';
import type Peer from 'peerjs';

/**
 * Hook que verifica periodicamente o status online/offline de uma lista de peer IDs
 * @param peerInstance Instância do Peer conectada
 * @param peerIds Lista de IDs para verificar
 * @param intervalMs Intervalo de verificação em ms (padrão: 30000 = 30s)
 * @returns Mapa de status { [id: string]: 'online' | 'offline' | 'checking' }
 */
export function usePeerStatusCheck(
    peerInstance: Peer | null,
    peerIds: string[],
    serverIp: string,
    intervalMs: number = 30000
): { [id: string]: 'online' | 'offline' | 'checking' } {
    const [statusMap, setStatusMap] = useState<{ [id: string]: 'online' | 'offline' | 'checking' }>({});
    const checkingRef = useRef(false);

    useEffect(() => {
        if (!peerInstance || peerIds.length === 0) {
            setStatusMap({});
            return;
        }

        const checkStatus = async () => {
            if (checkingRef.current) return;
            checkingRef.current = true;

            // NÃO resetamos tudo para "checking" de uma vez para evitar pisca-pisca visual.
            // Apenas iniciamos a verificação individual de cada um.

            // [FIX] Try HTTP Discovery first for custom servers to avoid "User-Initiated Abort" logs
            let httpSuccess = false;
            if (serverIp && serverIp !== 'cloud') {
                try {
                    // Default PeerJS server structure: http://host:9000/peerjs/:key/peers
                    // Default PeerJS server structure: http://host:9000/peerjs/:key/peers
                    const url = `http://${serverIp}:9000/peerjs/peerjs/peers`;

                    let activeIds: string[] | null = null;

                    if (window.electronAPI?.checkServerPeers) {
                        activeIds = await window.electronAPI.checkServerPeers(url);
                        if (activeIds === null) console.warn('[StatusCheck] IPC returned null (failed)');
                    } else {
                        // Fallback for browser dev (will likely fail CORS)
                        const controller = new AbortController();
                        const id = setTimeout(() => controller.abort(), 2000);
                        const response = await fetch(url, { signal: controller.signal });
                        clearTimeout(id);
                        if (response.ok) activeIds = await response.json();
                    }

                    if (activeIds) {
                        console.log('[StatusCheck] Received IDs from IPC:', activeIds.length, activeIds);
                        const newMap: any = {};
                        peerIds.forEach(pid => {
                            newMap[pid] = activeIds.includes(pid) ? 'online' : 'offline';
                        });
                        setStatusMap(prev => ({ ...prev, ...newMap }));
                        httpSuccess = true;
                    } else {
                        console.warn('[StatusCheck] activeIds evaluates to falsy:', activeIds);
                    }
                } catch (e) {
                    // Silent fail, fallback to WebRTC
                    console.warn('[StatusCheck] HTTP check failed, falling back to WebRTC:', e);
                }
            }

            if (httpSuccess) {
                console.log('[StatusCheck] HTTP check successful, skipping WebRTC probes.');
                checkingRef.current = false;
                return;
            }

            console.warn('[StatusCheck] Falling back to WebRTC probing loop!');
            for (const peerId of peerIds) {
                try {
                    // Cria uma conexão de teste temporária
                    const testConn = peerInstance.connect(peerId, {
                        reliable: true,
                        metadata: { type: 'status-check' }
                    });

                    // Aguarda conexão ou timeout
                    const isOnline = await new Promise<boolean>((resolve) => {
                        const timeout = setTimeout(() => {
                            // [FIX] Do NOT call close() here. Closing a 'connecting' channel causes "User-Initiated Abort".
                            // Just let it time out and be GC'd.
                            // testConn.close(); 
                            resolve(false);
                        }, 5000); // 5s timeout

                        testConn.on('open', () => {
                            clearTimeout(timeout);
                            // [FIX] Wait a bit before closing to avoid "User-Initiated Abort" spam
                            setTimeout(() => {
                                testConn.close();
                            }, 500);
                            resolve(true);
                        });

                        testConn.on('error', (err) => {
                            // Ignore peer-unavailable as it just means offline
                            if ((err as any).type !== 'peer-unavailable') {
                                console.warn(`[StatusCheck] Erro ao verificar ${peerId}:`, err);
                            }
                            clearTimeout(timeout);
                            resolve(false);
                        });

                        // Handle immediate close/error
                        testConn.on('close', () => {
                            clearTimeout(timeout);
                            resolve(false);
                        });
                    });

                    // Atualiza o status apenas deste peer individualmente
                    setStatusMap(prev => ({
                        ...prev,
                        [peerId]: isOnline ? 'online' : 'offline'
                    }));
                } catch (error) {
                    console.error(`[StatusCheck] Falha crítica ao verificar ${peerId}:`, error);
                    setStatusMap(prev => ({ ...prev, [peerId]: 'offline' }));
                }
            }

            checkingRef.current = false;
        };

        // Primeira verificação imediata
        checkStatus();

        // Verificações periódicas
        const interval = setInterval(checkStatus, intervalMs);

        return () => {
            clearInterval(interval);
            checkingRef.current = false;
        };
    }, [peerInstance, JSON.stringify(peerIds), intervalMs, serverIp]);

    return statusMap;
}
