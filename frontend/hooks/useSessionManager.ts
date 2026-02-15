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

    const connectDataOnly = useCallback(async (sessionId: string, remoteId: string) => {
        onLog(sessionId, `Iniciando handshake com: ${remoteId}`);
        onSessionUpdate(sessionId, { isAuthenticating: true });

        const uniquePeerId = `auth-${sessionId}-${Date.now()}`;
        const peer = new Peer(uniquePeerId, getPeerConfig());
        peersMap.current.set(sessionId, peer);

        peer.on('open', () => {
            onLog(sessionId, `Canal de dados aberto para autenticação`);
            const conn = peer.connect(remoteId, { reliable: false });
            conn.on('open', () => {
                onSessionUpdate(sessionId, { dataConnection: conn });
            });

            conn.on('error', (err) => {
                onLog(sessionId, `Erro no canal de dados: ${err}`);
                onSessionUpdate(sessionId, { isAuthenticating: false });
            });

            conn.on('close', () => {
                onLog(sessionId, 'Canal de dados fechado.');
                onSessionClose?.(sessionId, 'Conexão de dados encerrada pelo peer remoto.');
            });
        });

        peer.on('error', (err) => {
            onLog(sessionId, `Erro no Peer de Auth: ${err.message}`);
            onSessionUpdate(sessionId, { isAuthenticating: false });
        });
    }, [getPeerConfig, onLog, onSessionUpdate]);

    const startVideoCall = useCallback(async (sessionId: string, remoteId: string, localStream: MediaStream) => {
        const peer = peersMap.current.get(sessionId);
        if (!peer) return;

        onLog(sessionId, `Iniciando transmissão de vídeo...`);
        const call = peer.call(remoteId, localStream);
        callsMap.current.set(sessionId, call);

        call.on('stream', (remoteStream: MediaStream) => {
            onLog(sessionId, `Stream remoto recebido após AUTH!`);
            streamsMap.current.set(sessionId, remoteStream);
            onSessionUpdate(sessionId, {
                connected: true,
                isConnecting: false,
                isAuthenticating: false,
                remoteStream
            });
        });

        call.on('close', () => {
            onLog(sessionId, 'Chamada de vídeo finalizada.');
            onSessionClose?.(sessionId, 'Conexão de vídeo encerrada pelo peer remoto.');
        });

        call.on('error', (err) => {
            onLog(sessionId, `Erro na chamada: ${err}`);
            onSessionUpdate(sessionId, { connected: false, isConnecting: false });
        });
    }, [onLog, onSessionUpdate]);

    const connectToRemote = useCallback(async (sessionId: string, remoteId: string, localStream: MediaStream, metadata?: any) => {
        onLog(sessionId, `Conectando ao ID: ${remoteId}${metadata ? ' (Handover)' : ''}`);
        if (metadata) console.log('[SessionManager] 🚀 METADATA Recebido em connectToRemote:', metadata);
        onSessionUpdate(sessionId, { isConnecting: true });

        const uniquePeerId = `${sessionId}-${Date.now()}`;
        const peer = new Peer(uniquePeerId, getPeerConfig());
        peersMap.current.set(sessionId, peer);

        let connectedFlag = false;
        const timeout = setTimeout(() => {
            if (!connectedFlag) {
                onLog(sessionId, 'Tempo de conexão esgotado (30s). Cancelando tentativa.');
                console.warn(`[SessionManager] Timeout de conexão para ${sessionId}. Destruindo peer.`);
                onSessionUpdate(sessionId, { connected: false, isConnecting: false });
                onSessionClose?.(sessionId, 'Não foi possível conectar: Tempo de conexão esgotado.');
                peer.destroy();
            }
        }, 30000);

        peer.on('open', () => {
            onLog(sessionId, `Peer criado: ${uniquePeerId}`);
            const call = peer.call(remoteId, localStream, { metadata });

            if (!call) {
                console.error('[SessionManager] Falha ao criar chamada');
                clearTimeout(timeout);
                onSessionClose?.(sessionId, 'Erro ao iniciar chamada de vídeo.');
                return;
            }

            callsMap.current.set(sessionId, call);

            call.on('stream', (remoteStream: MediaStream) => {
                connectedFlag = true;
                clearTimeout(timeout);
                streamsMap.current.set(sessionId, remoteStream);
                console.log('[SessionManager] Stream de vídeo estabelecido. Autenticado?', metadata ? 'Sim (Handover)' : 'Não');
                onSessionUpdate(sessionId, {
                    connected: true,
                    isConnecting: false,
                    remoteStream,
                    status: 'connected',
                    isAuthenticated: !!metadata // [FIX] Assume autenticado se for handover e o stream abriu
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
                clearTimeout(timeout);
                onLog(sessionId, 'Chamada de vídeo finalizada.');
                onSessionClose?.(sessionId, 'Conexão de vídeo encerrada pelo peer remoto.');
            });

            call.on('error', (err) => {
                clearTimeout(timeout);
                onLog(sessionId, `Erro na chamada: ${err}`);
                onSessionUpdate(sessionId, { connected: false, isConnecting: false });
            });

            const conn = peer.connect(remoteId, { reliable: false, metadata });
            conn.on('open', () => {
                connectedFlag = true;
                clearTimeout(timeout);
                onSessionUpdate(sessionId, { dataConnection: conn });

                // [FIX] Send HANDOVER_VALIDATION immediately if token is present
                if (metadata?.handoverToken) {
                    console.log(`[SessionManager] 🚀 Enviando validação de HANDOVER para ${sessionId}`);
                    conn.send({ type: 'HANDOVER_VALIDATION', token: metadata.handoverToken });
                }
            });

            conn.on('close', () => {
                clearTimeout(timeout);
                onLog(sessionId, 'Canal de dados fechado.');
                onSessionClose?.(sessionId, 'Conexão de dados encerrada pelo peer remoto.');
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

    }, [getPeerConfig, onLog, onSessionUpdate]);

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
    }, [onLog, onSessionUpdate]);

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

        callsMap.current.forEach((call, sessionId) => {
            if (call && call.peerConnection) {
                const senders = call.peerConnection.getSenders();
                const videoSender = senders.find((s: any) => s.track && s.track.kind === 'video');
                if (videoSender) {
                    videoSender.replaceTrack(newVideoTrack).catch((err: any) => {
                        console.error(`Erro ao trocar monitor para sessão ${sessionId}:`, err);
                    });
                }
            }
        });
    }, []);

    return {
        connectToRemote,
        connectDataOnly,
        startVideoCall,
        answerCall,
        closeSession,
        getRemoteStream,
        updateLocalStream
    };
}
