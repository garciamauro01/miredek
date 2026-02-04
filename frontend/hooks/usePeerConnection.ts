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
    customPeerId?: string
) {
    const [myId, setMyId] = useState('');
    const [peerStatus, setPeerStatus] = useState<'online' | 'offline' | 'connecting'>('connecting');
    const [peerInstance, setPeerInstance] = useState<Peer | null>(null);
    const mainPeerRef = useRef<Peer | null>(null);

    useEffect(() => {
        let fixedId = customPeerId || localStorage.getItem('anydesk_clone_id');
        if (!fixedId) {
            fixedId = Math.floor(100000000 + Math.random() * 900000000).toString();
            if (!customPeerId) localStorage.setItem('anydesk_clone_id', fixedId);
        }

        const peerConfig = serverIp === 'cloud' ? {
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        } : {
            host: serverIp,
            port: 9000,
            path: '/peerjs',
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        };

        console.log('[Peer] Iniciando com config:', peerConfig);
        const peer = new Peer(fixedId, peerConfig);
        mainPeerRef.current = peer;
        setPeerInstance(peer);
        setPeerStatus('connecting');

        peer.on('open', (id) => {
            console.log('[Peer] ✅ Conectado com sucesso! Meu ID:', id);
            setMyId(id);
            setPeerStatus('online');
        });

        peer.on('disconnected', () => {
            setPeerStatus('connecting');
            peer.reconnect();
        });

        peer.on('close', () => setPeerStatus('offline'));
        peer.on('error', (err) => {
            console.error('[Peer] Error:', err);
            if (err.type === 'network' || err.type === 'server-error') {
                setPeerStatus('offline');
                setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, 5000);
            }
            if (err.type === 'unavailable-id') {
                localStorage.removeItem('anydesk_clone_id');
                setTimeout(() => window.location.reload(), 1000);
            }
        });

        peer.on('connection', (conn) => {
            console.log('[Peer] ✅ Conexão DATA recebida de:', conn.peer);
            setSessions(prev => {
                const existing = prev.find(s => s.remoteId === conn.peer);
                const sessionId = existing ? existing.id : `session-${Date.now()}`;

                if (existing) {
                    return prev.map(s => s.id === sessionId ? { ...s, dataConnection: conn, isIncoming: true } : s);
                } else {
                    // [FIX] Silência verificações de status
                    if (conn.metadata?.type === 'status-check') {
                        console.log('[Peer] Check de status recebido (Silencioso)');
                        return prev;
                    }

                    const newSession = createSession(sessionId, conn.peer, true);
                    newSession.dataConnection = conn;
                    if (!videoRefsMap.current.has(sessionId)) {
                        videoRefsMap.current.set(sessionId, { remote: React.createRef<HTMLVideoElement>() });
                    }
                    console.log('[Peer] Ativando janela para nova conexão DATA');
                    onShowRequest();
                    return [...prev, newSession];
                }
            });
            // Precisamos do sessionId aqui. 
            // Como setSessions é async, e nós geramos o ID, podemos usar o ID gerado.
            // Mas cuidado com concorrência.
            // O ideal é setupDataListeners ser chamado APÓS o estado atualizar, ou passar o ID certo.
            // Setup imediato é melhor para não perder mensagens.
            // Mas setupDataListeners precisa do ID para callbacks de fechar.
            // Vamos assumir que conseguimos recuperar o ID correto ou usar o timestamp.
            // Simplificação: recalculamos ID ou usamos lógica determinística se possível.
            // Mas aqui estamos usando Date.now().
            // Solução: Fazer o setup dentro do useEffect em RemoteSession/App monitorando sessions?
            // NÃO, setupDataListeners adiciona listeners no objeto conn. Feito uma vez.
            // Vamos fazer aqui mesmo.
            // Deixa para o App lidar com isso via `useEffect` ou passar callback que retorna ID.
        });

        peer.on('call', (call) => {
            console.log('[Peer] Call Recebido de:', call.peer, 'Metadata:', call.metadata);

            const isHandover = onHandoverCheck ? onHandoverCheck(call.metadata) : false;
            if (isHandover) console.log('[Peer] 🚀 Handover detectado! Pré-autenticando sessão.');

            setSessions(prev => {
                const existing = prev.find(s => s.remoteId === call.peer);
                const sessionId = existing ? existing.id : `session-${Date.now()}`;

                if (existing) {
                    return prev.map(s => s.id === sessionId ? { ...s, incomingCall: call, isIncoming: true, isAuthenticated: isHandover || s.isAuthenticated } : s);
                }

                // [FIX] Silência verificações de status em chamadas (raro mas possível)
                if (call.metadata?.type === 'status-check') {
                    console.log('[Peer] Check de status em CALL recebido (Silencioso)');
                    return prev;
                }

                const newSession = createSession(sessionId, call.peer, true);
                newSession.incomingCall = call;
                if (isHandover) newSession.isAuthenticated = true;

                if (!videoRefsMap.current.has(sessionId)) {
                    videoRefsMap.current.set(sessionId, { remote: React.createRef<HTMLVideoElement>() });
                }
                console.log('[Peer] Ativando janela para nova conexão CALL. Handover:', isHandover);
                if (!isHandover) onShowRequest(); // Notifica para abrir janela/focar apenas se não for handover interno
                return [...prev, newSession];
            });
        });

        return () => {
            peer.destroy();
            setPeerInstance(null);
        };

    }, [serverIp, setSessions, onShowRequest, onHandoverCheck, customPeerId]);

    return { myId, peerStatus, peerInstance, mainPeerRef };
}
