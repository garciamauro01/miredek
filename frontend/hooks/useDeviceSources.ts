import { useState, useRef, useEffect } from 'react';
import { useNativeScreenCapture } from './useNativeScreenCapture';

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

    // Native Capture Hook
    const { startNativeCapture, stopNativeCapture, nativeStream, isNativeActive } = useNativeScreenCapture();

    useEffect(() => {
        sourcesRef.current = sources;
    }, [sources]);

    useEffect(() => {
        currentSourceIdRef.current = currentSourceId;
    }, [currentSourceId]);

    // Update local stream when native stream becomes available
    useEffect(() => {
        if (isNativeActive && nativeStream) {
            console.log('[Host] Native Stream Active, updating local stream...');
            localStreamRef.current = nativeStream;
            updateLocalStream(nativeStream);
        }
    }, [isNativeActive, nativeStream, updateLocalStream]);

    // [FIX] Auto-select first source on mount
    useEffect(() => {
        const init = async () => {
            // Unificado: Sempre buscar do Agente Nativo, independente de ser Electron ou Browser
            try {
                const resp = await fetch('http://localhost:9876/monitors.json');
                const agentMonitors = await resp.json();
                console.log('[Host] Monitores reais encontrados via Agente:', agentMonitors);

                const nativeSources = agentMonitors.map((m: any) => ({
                    id: `native-${m.id}`,
                    name: `Monitor ${m.id + 1} (${m.width}x${m.height})`,
                    thumbnail: null
                }));

                setSources(nativeSources);

                if (nativeSources.length > 0) {
                    selectSource(nativeSources[0].id);
                } else {
                    console.warn('[Host] Nenhum monitor físico detectado pelo Agente.');
                }
            } catch (e) {
                console.warn('[Host] Agente Delphi não disponível localmente para listar monitores. Usando fallback do Electron.');
                if (window.electronAPI) {
                    try {
                        const electronSources = await window.electronAPI.getSources();
                        console.log('[Host] Monitores encontrados via Electron:', electronSources);
                        setSources(electronSources);
                        if (electronSources.length > 0) {
                            selectSource(electronSources[0].id);
                        } else {
                            console.warn('[Host] Nenhum monitor detectado pelo Electron.');
                        }
                    } catch (err) {
                        console.error('[Host] Falha ao obter fontes do Electron:', err);
                    }
                } else {
                    // Browser mode sem agente local (ex: acessando remoto)
                    selectSource('browser');
                }
            }
        };
        init();
    }, []);

    const selectSource = async (sourceId: string) => {
        console.log('[Host] Selecionando fonte:', sourceId);
        try {
            // Stop previous native capture if switching away
            if (currentSourceId.startsWith('native-') && !sourceId.startsWith('native-')) {
                stopNativeCapture();
            }

            if (sourceId.startsWith('native-')) {
                const midStr = sourceId.replace('native-', '');
                const monitorId = parseInt(midStr);

                console.log('[Host] Iniciando captura NATIVA para monitor:', monitorId);
                startNativeCapture(monitorId);
                setCurrentSourceId(sourceId);
                onSourceChanged(sourceId);
                return;
            }

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
                const constraints: any = {
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
                };
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            }

            console.log('[Host] Stream capturado com sucesso:', stream.id);
            localStreamRef.current = stream;
            setCurrentSourceId(sourceId);
            updateLocalStream(stream);
            onSourceChanged(sourceId);

        } catch (e) {
            console.error('Erro ao capturar tela:', e);
            // Fallback?
            throw e;
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
