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
            if (window.electronAPI) {
                const available = await window.electronAPI.getSources();

                // Add Native Options from Agent
                try {
                    const resp = await fetch('http://localhost:9876/monitors.json');
                    const agentMonitors = await resp.json();
                    console.log('[Host] Monitores nativos encontrados:', agentMonitors);

                    const nativeSources = agentMonitors.map((m: any) => ({
                        id: `native-${m.id}`,
                        name: `Monitor ${m.id + 1} (${m.width}x${m.height})`,
                        thumbnail: null
                    }));

                    // Sort: Monitor 1, 2, ...
                    nativeSources.sort((a: any, b: any) => {
                        const idA = parseInt(a.id.replace('native-', ''));
                        const idB = parseInt(b.id.replace('native-', ''));
                        return idA - idB;
                    });

                    // Se temos fontes nativas, removemos as fontes 'screen' (monitores) do Electron
                    // Mantemos 'window' (janelas) se existirem
                    const filteredAvailable = available.filter((s: any) => !s.id.startsWith('screen:'));
                    const finalSources = [...nativeSources, ...filteredAvailable];

                    setSources(finalSources);

                    if (finalSources.length > 0) {
                        selectSource(finalSources[0].id);
                    }
                } catch (e) {
                    console.warn('[Host] Agente Delphi não disponível para listar monitores.');
                    // Fallback to "Logon Screen" native source + Electron sources
                    const nativeSource = { id: 'native-service', name: 'MireDesk Native (Login Screen)', thumbnail: null };
                    const allFallback = [nativeSource, ...available];
                    setSources(allFallback);
                    selectSource(available[0]?.id || 'native-service');
                }
            } else {
                // Browser dev mode
                selectSource('browser');
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
                const monitorId = midStr === 'service' ? -1 : parseInt(midStr);

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
