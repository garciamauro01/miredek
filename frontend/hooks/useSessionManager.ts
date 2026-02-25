import { useRef, useCallback } from 'react';
import Peer from 'peerjs';
import type { Session } from '../types/Session';

interface UseSessionManagerProps {
    serverIp: string;
    onSessionUpdate: (sessionId: string, updates: Partial<Session>) => void;
    onSessionClose?: (sessionId: string, reason: string) => void;
    onLog: (sessionId: string, message: string) => void;
}

export function useSessionManager({ serverIp, onSessionUpdate, onSessionClose, onLog }: UseSessionManagerProps) {
    const peersMap = useRef<Map<string, Peer>>(new Map());
    const streamsMap = useRef<Map<string, MediaStream>>(new Map());
    const callsMap = useRef<Map<string, any>>(new Map()); // sessionId -> MediaConnection

    const getPeerConfig = useCallback(() => {
        if (serverIp === 'cloud') {
            return {
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                    ]
                }
            };
        }
        return {
            host: serverIp,
            port: 9000,
            path: '/peerjs',
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
                ]
            }
        };
    }, [serverIp]);

    const startVideoCall = useCallback(async (sessionId: string, remoteId: string, localStream: MediaStream, metadata?: any) => {
        const peer = peersMap.current.get(sessionId);
        if (!peer) {
            onLog(sessionId, `Erro: Peer não encontrado para iniciar vídeo.`);
            return;
        }

        onLog(sessionId, `Iniciando transmissão de vídeo...`);
        const call = peer.call(remoteId, localStream, { metadata });
        callsMap.current.set(sessionId, call);

        call.on('stream', (remoteStream: MediaStream) => {
            onLog(sessionId, `Stream remoto recebido!`);
            streamsMap.current.set(sessionId, remoteStream);
            onSessionUpdate(sessionId, {
                connected: true,
                isConnecting: false,
                isAuthenticating: false,
                remoteStream,
                status: 'connected'
            });

            if (call.peerConnection) {
                call.peerConnection.oniceconnectionstatechange = () => {
                    const state = call.peerConnection.iceConnectionState;
                    console.log(`[ICE-State] Session ${sessionId}: ${state}`);
                    if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                        onSessionUpdate(sessionId, { status: 'disconnected' });
                    } else if (state === 'connected' || state === 'completed') {
                        onSessionUpdate(sessionId, { status: 'connected' });
                    }
                };
            }
        });

        call.on('close', () => {
            onLog(sessionId, 'Chamada de vídeo finalizada.');
            onSessionClose?.(sessionId, 'Conexão de vídeo encerrada pelo peer remoto.');
        });

        call.on('error', (err) => {
            onLog(sessionId, `Erro na chamada: ${err}`);
            onSessionUpdate(sessionId, { connected: false, isConnecting: false });
        });
    }, [onLog, onSessionUpdate, onSessionClose]);

    const connectToRemote = useCallback(async (sessionId: string, remoteId: string, metadata?: any) => {
        onLog(sessionId, `Iniciando conexão de dados com: ${remoteId}${metadata ? ' (Handover)' : ''}`);
        onSessionUpdate(sessionId, { isConnecting: true });

        const uniquePeerId = `${sessionId}-${Date.now()}`;
        const peer = new Peer(uniquePeerId, getPeerConfig());
        peersMap.current.set(sessionId, peer);

        let connectedFlag = false;
        const timeout = setTimeout(() => {
            if (!connectedFlag) {
                onLog(sessionId, 'Tempo de conexão esgotado (30s). Cancelando tentativa.');
                onSessionUpdate(sessionId, { connected: false, isConnecting: false });
                onSessionClose?.(sessionId, 'Não foi possível conectar: Tempo de conexão esgotado.');
                peer.destroy();
            }
        }, 30000);

        peer.on('open', () => {
            onLog(sessionId, `Peer local pronto. Conectando canal de dados...`);

            const connectOptions: any = { reliable: false };
            if (metadata) connectOptions.metadata = metadata;

            const conn = peer.connect(remoteId, connectOptions);
            conn.on('open', () => {
                connectedFlag = true;
                clearTimeout(timeout);
                onLog(sessionId, 'Canal de dados estabelecido.');
                onSessionUpdate(sessionId, {
                    dataConnection: conn,
                    isConnecting: false,
                    // isAuthenticating stays false until user submits password
                });

                if (metadata?.handoverToken) {
                    conn.send({ type: 'HANDOVER_VALIDATION', token: metadata.handoverToken });
                }
            });

            conn.on('close', () => {
                clearTimeout(timeout);
                onLog(sessionId, 'Canal de dados fechado.');
                onSessionClose?.(sessionId, 'Conexão de dados encerrada pelo peer remoto.');
            });

            conn.on('error', (err) => {
                clearTimeout(timeout);
                onLog(sessionId, `Erro no canal de dados: ${err}`);
                onSessionUpdate(sessionId, { connected: false, isConnecting: false });
            });
        });

        peer.on('error', (err: any) => {
            clearTimeout(timeout);
            onLog(sessionId, `Erro no Peer: ${err.message}`);
            onSessionUpdate(sessionId, { connected: false, isConnecting: false });

            if (err.type === 'peer-unavailable') {
                onSessionClose?.(sessionId, 'O ID remoto não está disponível ou está offline.');
            }
        });

    }, [getPeerConfig, onLog, onSessionUpdate, onSessionClose]);

    const answerCall = useCallback(async (sessionId: string, call: any, localStream: MediaStream) => {
        onLog(sessionId, 'Respondendo chamada...');
        call.answer(localStream);
        callsMap.current.set(sessionId, call);

        call.on('stream', (remoteStream: MediaStream) => {
            onLog(sessionId, 'Stream remoto recebido!');
            streamsMap.current.set(sessionId, remoteStream);
            onSessionUpdate(sessionId, {
                connected: true,
                remoteStream,
                incomingCall: null,
                isAuthenticated: true,
                status: 'connected'
            });

            if (call.peerConnection) {
                call.peerConnection.oniceconnectionstatechange = () => {
                    const state = call.peerConnection.iceConnectionState;
                    console.log(`[ICE-State] Session ${sessionId}: ${state}`);
                    if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                        onSessionUpdate(sessionId, { status: 'disconnected' });
                    } else if (state === 'connected' || state === 'completed') {
                        onSessionUpdate(sessionId, { status: 'connected' });
                    }
                };
            }
        });

        call.on('close', () => {
            onLog(sessionId, 'Chamada de vídeo finalizada.');
            onSessionClose?.(sessionId, 'Conexão de vídeo encerrada pelo peer remoto.');
        });

        call.on('error', (err: any) => {
            onLog(sessionId, `Erro ao responder: ${err}`);
        });
    }, [onLog, onSessionUpdate, onSessionClose]);

    const closeSession = useCallback((sessionId: string) => {
        const call = callsMap.current.get(sessionId);
        if (call) {
            call.close();
            callsMap.current.delete(sessionId);
        }

        const peer = peersMap.current.get(sessionId);
        if (peer) {
            peer.destroy();
            peersMap.current.delete(sessionId);
        }

        const stream = streamsMap.current.get(sessionId);
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            streamsMap.current.delete(sessionId);
        }
    }, []);

    const getRemoteStream = useCallback((sessionId: string): MediaStream | null => {
        return streamsMap.current.get(sessionId) || null;
    }, []);

    const updateLocalStream = useCallback((newStream: MediaStream) => {
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (!newVideoTrack) return;

        callsMap.current.forEach((call) => {
            if (call && call.peerConnection) {
                const senders = call.peerConnection.getSenders();
                const videoSender = senders.find((s: any) => s.track && s.track.kind === 'video');
                if (videoSender) {
                    videoSender.replaceTrack(newVideoTrack).catch((err: any) => {
                        console.error(`Erro ao trocar monitor:`, err);
                    });
                }
            }
        });
    }, []);

    return {
        connectToRemote,
        startVideoCall,
        answerCall,
        closeSession,
        getRemoteStream,
        updateLocalStream
    };
}
