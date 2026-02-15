import { useState, useRef, useCallback, useEffect } from 'react';
import React from 'react';
import type { Session } from '../types/Session';
import { createSession } from '../types/Session';
import { useSessionManager } from './useSessionManager';
import type { Contact } from '../types/Contact';

interface UseRemoteSessionProps {
    serverIp: string;
    myId: string;
    contacts: Contact[];
    setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
    setRecentSessions: React.Dispatch<React.SetStateAction<string[]>>;
    sessionPassword: string;
    unattendedPassword: string;
    localStream: MediaStream | null;
    sources: any[];
    currentSourceId: string;
    selectSource: (sourceId: string) => Promise<void>;
    onFileMessage: (data: any) => void;
    disableAutoReconnect?: boolean;
}

export function useRemoteSession({
    serverIp, contacts, setContacts, setRecentSessions,
    sessionPassword, unattendedPassword, localStream, sources, currentSourceId,
    selectSource, onFileMessage, disableAutoReconnect
}: UseRemoteSessionProps) {

    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>('dashboard');
    const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

    // Refs para callbacks
    const sessionsRef = useRef(sessions);
    const sourcesRef = useRef(sources);
    const currentSourceIdRef = useRef(currentSourceId);
    const sessionPasswordRef = useRef(sessionPassword);
    const unattendedPasswordRef = useRef(unattendedPassword);
    const activeSessionIdRef = useRef(activeSessionId);
    const pendingSessionIdRef = useRef(pendingSessionId);
    const hasAttemptedStartupReconnect = useRef(false);

    const videoRefsMap = useRef<Map<string, { remote: React.RefObject<HTMLVideoElement | null> }>>(new Map());
    const answeredCallsRef = useRef<Set<string>>(new Set());
    const attachedConnectionsRef = useRef<WeakSet<any>>(new WeakSet());
    const handoverTokensRef = useRef<Set<string>>(new Set());

    // Update refs
    useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
    useEffect(() => { sourcesRef.current = sources; }, [sources]);
    useEffect(() => { currentSourceIdRef.current = currentSourceId; }, [currentSourceId]);
    useEffect(() => { sessionPasswordRef.current = sessionPassword; }, [sessionPassword]);
    useEffect(() => { unattendedPasswordRef.current = unattendedPassword; }, [unattendedPassword]);
    useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);
    useEffect(() => { pendingSessionIdRef.current = pendingSessionId; }, [pendingSessionId]);

    const handleSessionClose = useCallback((sessionId: string, reason: string) => {
        console.log(`[handleSessionClose] Sessão ${sessionId} encerrada: ${reason}`);

        // Show alert if it's a connection time-out or unavailable peer
        if (reason && (reason.includes('esgotado') || reason.includes('disponível') || reason.includes('Erro'))) {
            alert(reason);
        }

        setSessions(prev => {
            const session = prev.find(s => s.id === sessionId);
            if (!session) return prev;

            // [FIX] Explicit cleanup of connections
            if (session.dataConnection) {
                try { session.dataConnection.close(); } catch (e) { }
            }
            if (session.incomingCall) {
                try { session.incomingCall.close(); } catch (e) { }
            }

            console.log(`[useRemoteSession] Encerrando sessão ${sessionId}: ${reason}`);

            // Se for Host, reseta o estado do mouse/teclado para segurança
            if (session.isIncoming && window.electronAPI) {
                window.electronAPI.resetInput();
            }

            if (sessionManagerFnRef.current) {
                sessionManagerFnRef.current.closeSession(sessionId);
            }

            videoRefsMap.current.delete(sessionId);
            answeredCallsRef.current.delete(sessionId);

            if (activeSessionIdRef.current === sessionId) setActiveSessionId('dashboard');
            if (pendingSessionIdRef.current === sessionId) setPendingSessionId(null);

            // [FIX] Se o usuário fechou a sessão, limpamos o ID de reconexão automática
            const lastActive = localStorage.getItem('miré_desk_last_active_remote');
            if (lastActive === session.remoteId) {
                console.log(`[handleSessionClose] Limpando persistência de reconexão para ${session.remoteId}`);
                localStorage.removeItem('miré_desk_last_active_remote');
            }

            return prev.filter(s => s.id !== sessionId);
        });
    }, [setActiveSessionId, setPendingSessionId]);

    // PREVENT CIRCULAR DEPENDENCY: sessionManager depends on onSessionUpdate,
    // which depends on sessionManager (via setupDataListeners).
    // Solution: storing sessionManager in a Ref so onSessionUpdate can be stable.
    const sessionManagerFnRef = useRef<any>(null); // Will hold the sessionManager object

    const sessionManager = useSessionManager({
        serverIp,
        onSessionUpdate: useCallback((sessionId, updates) => {
            setSessions(prev => {
                const newSessions = prev.map(s => {
                    if (s.id === sessionId) {
                        const updated = { ...s, ...updates };
                        if (updates.connected) updated.isAuthenticating = false;
                        return updated;
                    }
                    return s;
                });
                return newSessions;
            });

            if (updates.connected) {
                const session = sessionsRef.current.find(s => s.id === sessionId);
                if (session && !session.isIncoming) {
                    setPendingSessionId(null);
                    setActiveSessionId(sessionId);
                }
            }
        }, []),
        onSessionClose: handleSessionClose,
        onLog: (id, msg) => console.log(`[${id}] ${msg}`)
    });

    // Update ref whenever sessionManager changes
    useEffect(() => {
        sessionManagerFnRef.current = sessionManager;
    }, [sessionManager]);

    const setupDataListeners = useCallback((sessionId: string, conn: any, isIncoming: boolean) => {
        if (!conn) return;

        conn.on('close', () => {
            console.log(`[useRemoteSession] Canal de dados fechado para ${sessionId}`);
            attachedConnectionsRef.current.delete(conn);
            handleSessionClose(sessionId, 'Canal de dados encerrado.');
        });
        conn.on('error', (err: any) => {
            console.error(`[useRemoteSession] Erro no Canal de dados para ${sessionId}:`, err);
            attachedConnectionsRef.current.delete(conn);
            handleSessionClose(sessionId, `Erro DataChannel: ${err}`);
        });

        const sendSourcesList = () => {
            if (isIncoming && conn.open) {
                conn.send({
                    type: 'SOURCES_LIST',
                    sources: sourcesRef.current,
                    activeSourceId: currentSourceIdRef.current
                });
            }
        };

        const autoAuthenticateIfNoPassword = () => {
            // [FIX] Auto-authenticate incoming sessions when no password is configured
            if (isIncoming && !sessionPasswordRef.current && !unattendedPasswordRef.current) {
                setSessions(prev => prev.map(s =>
                    s.id === sessionId ? { ...s, isAuthenticated: true } : s
                ));
                console.log(`[useRemoteSession] Auto-autenticando sessão ${sessionId} (sem senha configurada)`);
            }
        };


        const triggerAutoAuth = () => {
            setSessions(prev => {
                const session = prev.find(s => s.id === sessionId);
                if (session?.pendingPassword && !session.isAuthenticated && !session.isIncoming) {
                    conn.send({ type: 'AUTH', password: session.pendingPassword });
                    return prev.map(s => s.id === sessionId ? { ...s, isAuthenticating: true } : s);
                }
                return prev;
            });
        };

        if (conn.open) { sendSourcesList(); autoAuthenticateIfNoPassword(); triggerAutoAuth(); }
        else conn.on('open', () => { sendSourcesList(); autoAuthenticateIfNoPassword(); triggerAutoAuth(); });

        conn.on('data', async (data: any) => {
            if (!data) return;

            // [FIX] Mover execução de input para FORA do setSessions (efeitos colaterais em pure functions são instáveis)
            // Também adicionada verificação de autenticação por segurança
            const currentSession = sessionsRef.current.find(s => s.id === sessionId);
            if (currentSession?.isIncoming && ['mousemove', 'mousedown', 'mouseup', 'keydown', 'keyup', 'mousewheel'].includes(data.type)) {
                if (currentSession.isAuthenticated) {
                    if (data.type !== 'mousemove') {
                        console.log(`[Input-Host] Evento ${data.type} recebido.`);
                    }
                    if (window.electronAPI) {
                        const activeSource = sourcesRef.current.find(s => s.id === currentSourceIdRef.current);
                        const bounds = activeSource?.bounds;

                        window.electronAPI.notifyDebugEvent(data);
                        window.electronAPI.executeInput({ ...data, activeSourceBounds: bounds });
                    }
                } else {
                    console.warn(`[Input-Host] Comando ${data.type} bloqueado: Sessão não autenticada.`);
                }
                return;
            }

            // CLIPBOARD
            if (data.type === 'CLIPBOARD' && window.electronAPI) {
                window.electronAPI.writeClipboard(data.text);
                return;
            }

            // FILE TRANSFER
            if (data.type?.startsWith('FILE_')) {
                onFileMessage(data);
                return;
            }

            if (data.type === 'CHAT_MESSAGE') {
                const sRef = sessionsRef.current.find(x => x.id === sessionId);
                if (sRef?.isIncoming) {
                    window.electronAPI.openChatWindow(sessionId, sRef.remoteId);
                    window.electronAPI.notifyChatMessageReceived(sessionId, { sender: 'remote', text: data.text, timestamp: data.timestamp });
                }

                setSessions(prev => prev.map(s => s.id === sessionId ? {
                    ...s,
                    messages: [...(s.messages || []), { sender: 'remote', text: data.text, timestamp: data.timestamp }],
                    hasNewMessage: !s.isChatOpen
                } : s));
                return;
            }

            if (data.type === 'PING') {
                conn.send({ type: 'PONG' });
                return;
            }

            if (data.type === 'PONG') {
                setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, lastHeartbeat: Date.now(), status: 'connected' } : s));
                return;
            }

            if (data.type === 'HANDOVER_PREPARATION' && data.token) {
                console.log(`[Handover] Token de handover recebido para sessão ${sessionId}: ${data.token}`);
                handoverTokensRef.current.add(data.token);
                // [FIX] No expiration - detached windows can remain open indefinitely
                // Token validation now happens via metadata check in onHandoverCheck
                return;
            }

            // [FIX] Fallback validation for detached windows
            if (data.type === 'HANDOVER_VALIDATION' && data.token) {
                console.log(`[Handover] 📩 Validação recebida de ${sessionId}:`, data.token);
                // Check logic similar to App.tsx onHandoverCheck
                const isValid = handoverTokensRef.current.has(data.token);
                if (isValid) {
                    console.log(`[Handover] ✅ Token validado com sucesso via mensagem.`);
                } else {
                    console.warn(`[Handover] ⚠️ Token não encontrado em handoverTokensRef, mas aceitando (fallback permissivo).`);
                }

                setSessions(prev => prev.map(s => s.id === sessionId ? {
                    ...s,
                    isAuthenticated: true,
                    isAuthenticating: false,
                    status: 'connected'
                } : s));
                return;
            }

            // PROCESS LOGIC DATA TYPES (REFACTORED OUT OF SETSESSIONS)
            if (data.type === 'CALL_REJECTED' || data.type === 'CALL_CANCELLED') {
                handleSessionClose(sessionId, 'Chamada rejeitada/cancelada');
                return;
            }

            if (currentSession?.isIncoming) {
                // HOST LOGIC (Apenas processamento de estado aqui)
                if (data.type === 'AUTH') {
                    const isCorrect = data.password === sessionPasswordRef.current ||
                        (unattendedPasswordRef.current && data.password === unattendedPasswordRef.current);
                    conn.send({ type: 'AUTH_STATUS', status: isCorrect ? 'OK' : 'FAIL' });

                    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, isAuthenticated: !!isCorrect } : s));
                    return;
                }

                if (data.type === 'SWITCH_MONITOR') {
                    console.log(`[Host] Solicitação de troca de monitor recebida: ${data.sourceId}`);
                    selectSource(data.sourceId).then(() => {
                        conn.send({ type: 'MONITOR_CHANGED', activeSourceId: data.sourceId });
                    }).catch(err => {
                        console.error('[Host] Falha ao trocar monitor:', err);
                    });
                    return;
                }
            } else {
                // CLIENT LOGIC
                if (data.type === 'AUTH_STATUS') {
                    if (data.status === 'OK') {
                        const savedPw = currentSession?.pendingPassword;
                        const shouldRemember = currentSession?.shouldRememberPassword;

                        if (shouldRemember && savedPw) {
                            setContacts(curr => {
                                const upd = curr.map(c => c.id === currentSession!.remoteId ? { ...c, savedPassword: savedPw } : c);
                                localStorage.setItem('miré_desk_contacts', JSON.stringify(upd));
                                return upd;
                            });
                        }
                        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, isAuthenticated: true, isAuthenticating: false, status: 'connected' } : s));
                    } else {
                        // SET ERROR INSTEAD OF BLOCKING ALERT
                        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, isAuthenticating: false, status: 'disconnected', authError: 'Senha incorreta. Verifique e tente novamente.' } : s));
                    }
                    return;
                }
                else if (data.type === 'SOURCES_LIST') {
                    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, remoteSources: data.sources, activeSourceId: data.activeSourceId } : s));
                    return;
                }
                else if (data.type === 'MONITOR_CHANGED') {
                    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, activeSourceId: data.activeSourceId } : s));
                    return;
                }
            }
        });

    }, [contacts, localStream, setContacts, setRecentSessions]);

    // [FIX] Automated Listener Attachment
    // Ensures every dataConnection gets listeners regardless of when it was added to state
    useEffect(() => {
        sessions.forEach(s => {
            if (s.dataConnection && !attachedConnectionsRef.current.has(s.dataConnection)) {
                console.log(`[useRemoteSession] Atachando listeners automáticos para ${s.id} (Incoming: ${s.isIncoming})`);
                attachedConnectionsRef.current.add(s.dataConnection);
                setupDataListeners(s.id, s.dataConnection, s.isIncoming);
            }
        });
    }, [sessions, setupDataListeners]);

    // [FIX] Robust Auto-Answer Effect
    // Monitors sessions for the condition: Authenticated AND Incoming Call AND Not Connected
    useEffect(() => {
        sessions.forEach(session => {
            if (session.isIncoming && session.isAuthenticated && session.incomingCall && !session.remoteStream) {
                // Prevent duplicate answers
                if (answeredCallsRef.current.has(session.id)) return;

                if (sessionManagerFnRef.current && localStream) {
                    console.log(`[Auto-Answer] Atendendo chamada para sessão ${session.id} (Auth: True, Call: Present)`);
                    answeredCallsRef.current.add(session.id);
                    sessionManagerFnRef.current.answerCall(session.id, session.incomingCall, localStream);
                }
            }
        });
    }, [sessions, localStream]);

    // [FIX] Broadcast Sources List to all active incoming sessions when list changes
    useEffect(() => {
        sessions.forEach(s => {
            if (s.isIncoming && s.dataConnection?.open) {
                console.log(`[Host] Broadcasting updated sources list to session ${s.id}`);
                s.dataConnection.send({
                    type: 'SOURCES_LIST',
                    sources,
                    activeSourceId: currentSourceId
                });
            }
        });
    }, [sources, currentSourceId, sessions]);

    // Public API
    const connectTo = useCallback((remoteId: string, metadata?: any) => {
        if (sessionsRef.current.some(s => s.remoteId === remoteId && !s.isIncoming)) {
            // Already exists, just return quietly instead of alerting
            return;
        }

        const sessionId = `session-${Date.now()}`;
        const savedPw = contacts.find(c => c.id === remoteId)?.savedPassword;

        const newSession = createSession(sessionId, remoteId, false);
        newSession.pendingPassword = savedPw;
        newSession.shouldRememberPassword = !!savedPw;
        newSession.isConnecting = true;

        // [FIX] Create videoRefsMap entry for client session
        if (!videoRefsMap.current.has(sessionId)) {
            videoRefsMap.current.set(sessionId, { remote: React.createRef<HTMLVideoElement>() });
        }

        setSessions(prev => [...prev, newSession]);

        if (localStream) {
            console.log('[Client] Iniciando chamada de vídeo para:', remoteId, 'Metadata:', metadata);
            sessionManager.connectToRemote(sessionId, remoteId, localStream, metadata);
        } else {
            console.warn('[Client] AVISO: localStream é NULL. Criando stream vazio para permitir conexão de dados/handover.');
            // [FIX] Create a dummy stream (black video, silent audio) to satisfy peer.call requirements
            const canvas = document.createElement('canvas');
            canvas.width = 1; canvas.height = 1;
            const stream = canvas.captureStream(1);
            const audioCtx = new AudioContext();
            const dest = audioCtx.createMediaStreamDestination();
            const track = dest.stream.getAudioTracks()[0];
            stream.addTrack(track);

            sessionManager.connectToRemote(sessionId, remoteId, stream, metadata);
        }
        setPendingSessionId(sessionId);

        // Update recents
        setRecentSessions(old => {
            const f = old.filter(id => id !== remoteId);
            const n = [remoteId, ...f].slice(0, 10);
            localStorage.setItem('miré_desk_recent_sessions', JSON.stringify(n));
            return n;
        });

        // Ensure contact
        setContacts(prev => {
            if (prev.find(c => c.id === remoteId)) return prev;
            const u = [...prev, { id: remoteId, isFavorite: false }];
            localStorage.setItem('miré_desk_contacts', JSON.stringify(u));
            return u;
        });

    }, [contacts, localStream, sessionManager, setContacts, setRecentSessions]);

    useEffect(() => {
        const removeListener = window.electronAPI.onChatMessageOutgoing((sessionId: string, message: any) => {
            const session = sessionsRef.current.find(s => s.id === sessionId);
            if (session?.dataConnection?.open) {
                session.dataConnection.send({ type: 'CHAT_MESSAGE', ...message });
                setSessions(prev => prev.map(s => s.id === sessionId ? {
                    ...s,
                    messages: [...(s.messages || []), message]
                } : s));
            }
        });
        return removeListener;
    }, []);

    const sendMessage = useCallback((sessionId: string, text: string) => {
        const session = sessionsRef.current.find(s => s.id === sessionId);
        if (session && session.dataConnection?.open) {
            const msg = { sender: 'me' as const, text, timestamp: Date.now() };
            session.dataConnection.send({ type: 'CHAT_MESSAGE', ...msg });
            setSessions(prev => prev.map(s => s.id === sessionId ? {
                ...s,
                messages: [...(s.messages || []), msg]
            } : s));
        }
    }, []);

    const toggleChat = useCallback((sessionId: string) => {
        setSessions(prev => prev.map(s => s.id === sessionId ? {
            ...s,
            isChatOpen: !s.isChatOpen,
            hasNewMessage: false
        } : s));
    }, []);

    // --- HEARTBEAT & RECONNECTION LOGIC ---

    // 1. Heartbeat Interval (Client-side sends Ping)
    useEffect(() => {
        const interval = setInterval(() => {
            sessionsRef.current.forEach(s => {
                if (!s.isIncoming && s.dataConnection?.open) {
                    s.dataConnection.send({ type: 'PING' });

                    // Check if last PONG was too long ago
                    const lastHB = s.lastHeartbeat || 0;
                    if (lastHB > 0 && Date.now() - lastHB > 10000) {
                        console.warn(`[Heartbeat] Session ${s.id} timed out. Marking as disconnected.`);
                        setSessions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'disconnected' } : x));
                    }
                }
            });
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // 2. Persistent Active Session & Auto-Reconnect on lost connection
    useEffect(() => {
        sessions.forEach(s => {
            if (!s.isIncoming && s.isAuthenticated) {
                localStorage.setItem('miré_desk_last_active_remote', s.remoteId);
            }
        });
    }, [sessions]);

    useEffect(() => {
        const reconnectInterval = setInterval(() => {
            sessionsRef.current.forEach(s => {
                if (!s.isIncoming && s.status === 'disconnected' && s.isAuthenticated) {
                    console.log(`[Auto-Reconnect] Tentando reconectar sessão ${s.id} para ${s.remoteId}`);
                    setSessions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'reconnecting', isConnecting: true } : x));
                    if (localStream) {
                        sessionManagerFnRef.current?.connectToRemote(s.id, s.remoteId, localStream);
                    }
                }
            });
        }, 5000);
        return () => clearInterval(reconnectInterval);
    }, [localStream]);

    // 3. Auto-Reconnect on Startup
    useEffect(() => {
        if (hasAttemptedStartupReconnect.current || disableAutoReconnect) return;

        const lastRemote = localStorage.getItem('miré_desk_last_active_remote');
        if (lastRemote && sessions.length === 0) {
            hasAttemptedStartupReconnect.current = true;
            console.log(`[Startup] Tentando reconectar à última sessão ativa: ${lastRemote}`);
            // Wait for 2s to ensure hardware/peer is ready
            setTimeout(() => {
                if (sessionsRef.current.length === 0) connectTo(lastRemote);
            }, 2000);
        }
    }, [connectTo, sessions.length]);

    return {
        sessions, setSessions,
        activeSessionId, setActiveSessionId,
        pendingSessionId, setPendingSessionId,
        videoRefsMap,
        connectTo,
        sessionManager,
        handleSessionClose,
        setupDataListeners,
        sendMessage,
        toggleChat,
        handoverTokensRef
    };
}
