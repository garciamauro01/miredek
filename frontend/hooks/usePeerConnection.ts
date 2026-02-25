import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { createSession } from '../types/Session';
import type { Session } from '../types/Session';

export function usePeerConnection(
    serverIp: string,
    setSessions: React.Dispatch<React.SetStateAction<Session[]>>,
    videoRefsMap: React.MutableRefObject<Map<string, { remote: React.RefObject<HTMLVideoElement | null> }>>,
    _setupDataListeners: (sessionId: string, conn: any, isIncoming: boolean) => void,
    onShowRequest: () => void,
    onHandoverCheck?: (metadata: any) => boolean,
    customPeerId?: string,
    onAutoAnswer?: (sessionId: string, call: any) => void,
    sessionsRef?: React.MutableRefObject<Session[]>
) {
    const [myId, setMyId] = useState('');
    const [peerStatus, setPeerStatus] = useState<'online' | 'offline' | 'connecting'>('connecting');
    const [peerInstance, setPeerInstance] = useState<Peer | null>(null);
    const mainPeerRef = useRef<Peer | null>(null);

    useEffect(() => {
        const initPeer = async () => {
            let fixedId = customPeerId;

            if (!fixedId && window.electronAPI?.getMachineId) {
                fixedId = await window.electronAPI.getMachineId();
            }

            if (!fixedId) {
                // Fallback de segurança se falhar o IPC
                fixedId = Math.floor(100000000 + Math.random() * 900000000).toString();
            }

            const peerConfig = serverIp === 'cloud' ? {
                config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
            } : {
                host: serverIp,
                port: 9000,
                path: '/peerjs',
                config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
            };

            console.log('[Peer] Iniciando com ID:', fixedId, 'Config:', peerConfig);
            const peer = new Peer(fixedId, peerConfig);
            mainPeerRef.current = peer;
            setPeerInstance(peer);
            setPeerStatus('connecting');

            peer.on('open', (id) => {
                console.log('[Peer] ✅ Conectado com sucesso! Meu ID:', id);
                setMyId(id);
                setPeerStatus('online');
            });

            // ... (restante dos listeners de erro, conexão, call permanecem iguais)
            setupListeners(peer);
        };

        const setupListeners = (peer: Peer) => {
            peer.on('disconnected', () => {
                console.warn('[Peer] ⚠️ Desconectado do servidor. Tentando reconectar...');
                setPeerStatus('connecting');
                setTimeout(() => {
                    if (!peer.destroyed && !peer.disconnected) return;
                    peer.reconnect();
                }, 3000);
            });

            peer.on('close', () => {
                console.error('[Peer] 🛑 Conexão encerrada permanentemente.');
                setPeerStatus('offline');
            });

            peer.on('error', (err) => {
                console.error(`[Peer] ❌ Erro do tipo "${err.type}":`, err);
                if (err.type === 'network' || err.type === 'server-error') {
                    setPeerStatus('offline');
                    setTimeout(() => {
                        if (!peer.destroyed) peer.reconnect();
                    }, 5000);
                }
                if (err.type === 'unavailable-id') {
                    console.error('[Peer] ID indisponível no servidor.');
                    // Aqui não apagamos mais do localStorage, deixamos o backend lidar se for o caso
                }
            });

            peer.on('connection', (conn) => {
                console.log('[Peer] ✅ Conexão DATA recebida de:', conn.peer);
                console.log('[Peer] 🔍 Metadata recebido:', conn.metadata);
                const isHandover = onHandoverCheck ? onHandoverCheck(conn.metadata) : false;

                setSessions(prev => {
                    const existing = prev.find(s => s.remoteId === conn.peer);
                    const sessionId = existing ? existing.id : `session-${Date.now()}`;
                    if (existing) {
                        return prev.map(s => s.id === sessionId ? { ...s, dataConnection: conn, isIncoming: true, isAuthenticated: isHandover || s.isAuthenticated, metadata: conn.metadata } : s);
                    } else {
                        if (conn.metadata?.type === 'status-check') return prev;

                        console.log('[Peer] ✨ Criando nova sessão para:', conn.peer);
                        const newSession = createSession(sessionId, conn.peer, true);
                        newSession.dataConnection = conn;
                        newSession.metadata = conn.metadata;

                        // [FIX] Handover Check for Data Connection
                        if (isHandover) {
                            console.log('[Peer] 🚀 Handover VALIDADO na conexão de DADOS via Metadata!');
                            newSession.isAuthenticated = true;
                            newSession.isAuthenticating = false;
                            newSession.status = 'connected';
                        }
                        if (!videoRefsMap.current.has(sessionId)) {
                            videoRefsMap.current.set(sessionId, { remote: React.createRef<HTMLVideoElement>() });
                        }
                        if (!isHandover) onShowRequest();
                        return [...prev, newSession];
                    }
                });
            });

            peer.on('call', (call) => {
                console.log('[Peer] Call Recebido de:', call.peer);
                const isHandover = onHandoverCheck ? onHandoverCheck(call.metadata) : false;

                // [FIX] Use sessionsRef for fresh state to avoid stale closure
                const currentSessions = sessionsRef ? sessionsRef.current : [];
                const existingFresh = currentSessions.find(s => s.remoteId === call.peer);
                const shouldBeAuthFresh = isHandover || (existingFresh?.isAuthenticated ?? false);

                console.log(`[Peer] Call de ${call.peer}. Fresh isAuthenticated: ${existingFresh?.isAuthenticated}, shouldBeAuth: ${shouldBeAuthFresh}, Handover: ${isHandover}`);

                // Auto-answer BEFORE setState to avoid race
                if (shouldBeAuthFresh && onAutoAnswer && existingFresh) {
                    console.log(`[Peer] ⚡ Auto-atendendo call autenticado de ${call.peer} (sessionId: ${existingFresh.id})`);
                    onAutoAnswer(existingFresh.id, call);
                }

                setSessions(prev => {
                    const existing = prev.find(s => s.remoteId === call.peer);

                    if (existing) {
                        const shouldBeAuth = isHandover || existing.isAuthenticated;
                        return prev.map(s => s.id === existing.id ? {
                            ...s,
                            incomingCall: call,
                            isIncoming: true,
                            isAuthenticated: shouldBeAuth,
                            metadata: call.metadata
                        } : s);
                    }

                    console.log(`[Peer] Nova sessão via Call de ${call.peer}. Handover: ${isHandover}`);
                    const sessionId = `session-${call.peer}`;
                    const newSession = createSession(sessionId, call.peer, true);
                    newSession.incomingCall = call;
                    newSession.metadata = call.metadata;
                    if (isHandover) {
                        newSession.isAuthenticated = true;
                        if (onAutoAnswer) onAutoAnswer(sessionId, call);
                    }

                    if (!videoRefsMap.current.has(sessionId)) {
                        videoRefsMap.current.set(sessionId, { remote: React.createRef<HTMLVideoElement>() });
                    }

                    if (!isHandover) onShowRequest();
                    return [...prev, newSession];
                });
            });
        };

        initPeer();

        return () => {
            console.log('[Peer] 🛑 Limpando efeito de usePeerConnection e destruindo peer...');
            if (mainPeerRef.current) {
                mainPeerRef.current.destroy();
                setPeerInstance(null);
            }
        };

    }, [serverIp, setSessions, onShowRequest, onHandoverCheck, customPeerId]);

    return { myId, peerStatus, peerInstance, mainPeerRef };
}
