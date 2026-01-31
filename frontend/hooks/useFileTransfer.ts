import { useState, useRef } from 'react';
import type { FileTransferState } from '../types/FileTransfer';

export function useFileTransfer() {
    const [transfers, setTransfers] = useState<{ [key: string]: FileTransferState }>({});
    const transferNamesRef = useRef<{ [key: string]: string }>({});

    const sendFile = async (dataConnection: any, filePath: string, x?: number, y?: number) => {
        if (!window.electronAPI) return;
        if (!dataConnection || !dataConnection.open) return;

        try {
            const fileInfo = await window.electronAPI.getFileInfo(filePath);
            const transferId = `tf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            setTransfers(prev => ({
                ...prev,
                [transferId]: { id: transferId, name: fileInfo.name, size: fileInfo.size, received: 0, status: 'sending', progress: 0 }
            }));

            dataConnection.send({
                type: 'FILE_START',
                transferId,
                name: fileInfo.name,
                size: fileInfo.size,
                dropX: x,
                dropY: y
            });

            const CHUNK_SIZE = 64 * 1024; // 64KB
            let offset = 0;

            while (offset < fileInfo.size) {
                const size = Math.min(CHUNK_SIZE, fileInfo.size - offset);
                // @ts-ignore - ElectronAPI typedef might need update
                const chunk = await window.electronAPI.readFileChunk(filePath, offset, size);

                dataConnection.send({
                    type: 'FILE_CHUNK',
                    transferId,
                    chunk
                });

                offset += size;
                const progress = Math.round((offset / fileInfo.size) * 100);
                setTransfers(prev => ({
                    ...prev,
                    [transferId]: { ...prev[transferId], received: offset, progress }
                }));

                // Pequeno delay para não sobrecarregar
                if (offset % (CHUNK_SIZE * 10) === 0) {
                    await new Promise(r => setTimeout(r, 10));
                }
            }

            dataConnection.send({ type: 'FILE_END', transferId });
            setTransfers(prev => ({
                ...prev,
                [transferId]: { ...prev[transferId], status: 'completed', progress: 100 }
            }));

        } catch (err) {
            console.error('Erro no envio de arquivo:', err);
        }
    };

    const receiveCoordsRef = useRef<{ [key: string]: { x: number, y: number } }>({});

    const handleFileMessage = async (data: any) => {
        if (!window.electronAPI) return;

        if (data.type === 'FILE_START') {
            const { transferId, name, size, dropX, dropY } = data;
            transferNamesRef.current[transferId] = name;
            receiveCoordsRef.current[transferId] = { x: dropX, y: dropY };

            setTransfers(prev => ({
                ...prev,
                [transferId]: { id: transferId, name, size, received: 0, status: 'receiving', progress: 0 }
            }));
        } else if (data.type === 'FILE_CHUNK') {
            const { transferId, chunk } = data;
            await window.electronAPI.saveFileChunk(transferId, chunk);
            setTransfers(prev => {
                const t = prev[transferId];
                if (!t) return prev;
                const received = t.received + chunk.length;
                const progress = Math.round((received / t.size) * 100);
                return {
                    ...prev,
                    [transferId]: { ...t, received, progress }
                };
            });
        } else if (data.type === 'FILE_END') {
            const { transferId } = data;
            const name = transferNamesRef.current[transferId];
            const coords = receiveCoordsRef.current[transferId];

            if (name) {
                const finalPath = await window.electronAPI.finalizeFile(transferId, name, coords?.x, coords?.y);
                delete receiveCoordsRef.current[transferId];
                setTransfers(prev => ({
                    ...prev,
                    [transferId]: { ...prev[transferId], status: 'completed', progress: 100 }
                }));
                console.log(`Arquivo salvo em: ${finalPath}`);
                delete transferNamesRef.current[transferId];
            }
        }
    };

    return {
        transfers,
        setTransfers,
        transferNamesRef,
        sendFile,
        handleFileMessage
    };
}
