import { useEffect, useRef } from 'react';
import type { Session } from '../types/Session';

export function useClipboardSync(
    sessions: Session[],
    activeSessionId: string | null,
    onSendFile: (sessionId: string, path: string) => Promise<void>
) {
    const lastClipboardRef = useRef<string>('');

    useEffect(() => {
        if (!window.electronAPI) return;

        const pollClipboard = async () => {
            // Monitora se houver sessão ativa conectada
            const activeSession = sessions.find(s => s.id === activeSessionId && s.connected);
            if (!activeSession) return;

            try {
                const currentText = await window.electronAPI.readClipboard();
                if (currentText && currentText !== lastClipboardRef.current) {
                    lastClipboardRef.current = currentText;

                    // Detecção de arquivo no clipboard
                    if (currentText.match(/^[a-zA-Z]:\\.*$/) || currentText.startsWith('/') || currentText.startsWith('\\\\')) {
                        try {
                            const info = await window.electronAPI.getFileInfo(currentText);
                            if (info && info.size > 0) {
                                console.log('Arquivo detectado no clipboard, enviando:', info.path);
                                await onSendFile(activeSession.id, info.path);
                                return;
                            }
                        } catch (e) { /* fallback para texto */ }
                    }

                    if (activeSession.dataConnection && activeSession.dataConnection.open) {
                        activeSession.dataConnection.send({
                            type: 'CLIPBOARD',
                            text: currentText
                        });
                        console.log('Clipboard enviado:', currentText.substring(0, 20) + '...');
                    }
                }
            } catch (err) {
                // Ignora erros silenciosos de leitura
            }
        };

        const interval = setInterval(pollClipboard, 1500);
        return () => clearInterval(interval);
    }, [sessions, activeSessionId, onSendFile]);

    return { lastClipboardRef };
}
