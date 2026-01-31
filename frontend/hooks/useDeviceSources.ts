import { useState, useRef, useEffect } from 'react';

export function useDeviceSources(
    updateLocalStream: (stream: MediaStream) => void,
    onSourceChanged: (sourceId: string) => void
) {
    const [sources, setSources] = useState<any[]>([]);
    const [currentSourceId, setCurrentSourceId] = useState<string>('');

    // Refs para acesso atualizado
    const sourcesRef = useRef(sources);
    const localStreamRef = useRef<MediaStream | null>(null);
    const currentSourceIdRef = useRef(currentSourceId);

    useEffect(() => {
        sourcesRef.current = sources;
    }, [sources]);

    useEffect(() => {
        currentSourceIdRef.current = currentSourceId;
    }, [currentSourceId]);

    const selectSource = async (sourceId: string) => {
        console.log('[Host] Selecionando fonte:', sourceId);
        try {
            let stream: MediaStream;
            if (sourceId === 'browser' || !window.electronAPI) {
                console.log('[Host] Usando getDisplayMedia (Navegador)');
                if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                    throw new Error('getDisplayMedia não está disponível. Certifique-se de estar usando HTTPS ou localhost.');
                }
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false
                });
            } else {
                console.log('[Host] Usando getUserMedia (Electron) para Source ID:', sourceId);
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: sourceId,
                            minWidth: 1280,
                            maxWidth: 3840,
                            minHeight: 720,
                            maxHeight: 2160
                        }
                    }
                } as any);
            }

            console.log('[Host] Stream capturado com sucesso:', stream.id);
            localStreamRef.current = stream;
            setCurrentSourceId(sourceId);

            // Notifica gerenciador e callback
            updateLocalStream(stream);
            onSourceChanged(sourceId);

        } catch (e) {
            console.error('Erro ao capturar tela:', e);
            throw e; // Propaga erro para quem chamou poder tratar se quiser
        }
    };

    return {
        sources,
        setSources,
        currentSourceId,
        selectSource,
        localStreamRef,
        sourcesRef,
        currentSourceIdRef
    };
}
