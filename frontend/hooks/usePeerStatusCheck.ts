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
                            testConn.close();
                            resolve(false);
                        }, 5000); // 5s timeout

                        testConn.on('open', () => {
                            clearTimeout(timeout);
                            testConn.close();
                            resolve(true);
                        });

                        testConn.on('error', (err) => {
                            console.warn(`[StatusCheck] Erro ao verificar ${peerId}:`, err);
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
    }, [peerInstance, JSON.stringify(peerIds), intervalMs]);

    return statusMap;
}
