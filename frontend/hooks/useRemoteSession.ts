import { useState, useRef, useCallback, useEffect } from 'react';
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
    onFileMessage: (data: any) => void;
}

export function useRemoteSession({
    serverIp, contacts, setContacts, setRecentSessions,
    sessionPassword, unattendedPassword, localStream, sources, currentSourceId,
    onFileMessage
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
    const videoRefsMap = useRef<Map<string, { remote: React.RefObject<HTMLVideoElement | null> }>>(new Map());

    // Update refs
    useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
    useEffect(() => { sourcesRef.current = sources; }, [sources]);
    useEffect(() => { currentSourceIdRef.current = currentSourceId; }, [currentSourceId]);
    useEffect(() => { sessionPasswordRef.current = sessionPassword; }, [sessionPassword]);
    useEffect(() => { unattendedPasswordRef.current = unattendedPassword; }, [unattendedPassword]);

    const handleSessionClose = useCallback((sessionId: string, reason: string) => {
        console.log(`[handleSessionClose] Sessão ${sessionId} encerrada: ${reason}`);

        setSessions(prev => {
            if (!prev.find(s => s.id === sessionId)) return prev;
            videoRefsMap.current.delete(sessionId);
            return prev.filter(s => s.id !== sessionId);
        });

        if (activeSessionId === sessionId) setActiveSessionId('dashboard');
        if (pendingSessionId === sessionId) setPendingSessionId(null);

    }, [activeSessionId, pendingSessionId]);

    // PREVENT CIRCULAR DEPENDENCY: sessionManager depends on onSessionUpdate,
    // which depends on sessionManager (via setupDataListeners).
    // Solution: storing sessionManager in a Ref so onSessionUpdate can be stable.
    const sessionManagerFnRef = useRef<any>(null); // Will hold the sessionManager object

    const setupDataListeners = useCallback((sessionId: string, conn: any, isIncoming: boolean) => {
        if (!conn) return;

        conn.on('close', () => handleSessionClose(sessionId, 'Canal de dados encerrado.'));
        conn.on('error', (err: any) => handleSessionClose(sessionId, `Erro DataChannel: ${err}`));

        const sendSourcesList = () => {
            if (isIncoming && conn.open) {
                conn.send({
                    type: 'SOURCES_LIST',
                    sources: sourcesRef.current,
                    activeSourceId: currentSourceIdRef.current
                });
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

        if (conn.open) { sendSourcesList(); triggerAutoAuth(); }
        else conn.on('open', () => { sendSourcesList(); triggerAutoAuth(); });

        conn.on('data', async (data: any) => {
            if (!data) return;

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

            // LOGIC
            setSessions(prev => {
                const session = prev.find(s => s.id === sessionId);
                if (!session) return prev;

                if (data.type === 'CALL_REJECTED' || data.type === 'CALL_CANCELLED') {
                    handleSessionClose(sessionId, 'Chamada rejeitada/cancelada');
                    return prev.filter(s => s.id !== sessionId);
                }

                if (session.isIncoming) {
                    // HOST LOGIC
                    if (data.type === 'AUTH') {
                        const isCorrect = data.password === sessionPasswordRef.current ||
                            (unattendedPasswordRef.current && data.password === unattendedPasswordRef.current);
                        conn.send({ type: 'AUTH_STATUS', status: isCorrect ? 'OK' : 'FAIL' });
                        return prev.map(s => s.id === sessionId ? { ...s, isAuthenticated: !!isCorrect } : s);
                    }
                    else if (['mousemove', 'mousedown', 'mouseup', 'keydown', 'keyup'].includes(data.type)) {
                        if (window.electronAPI) {
                            const activeSource = sourcesRef.current.find(s => s.id === currentSourceIdRef.current);
                            window.electronAPI.executeInput({ ...data, activeSourceBounds: activeSource?.bounds });
                        }
                    }
                } else {
                    // CLIENT LOGIC
                    if (data.type === 'AUTH_STATUS') {
                        if (data.status === 'OK') {
                            if (session.shouldRememberPassword && session.pendingPassword) {
                                setContacts(curr => {
                                    const upd = curr.map(c => c.id === session.remoteId ? { ...c, savedPassword: session.pendingPassword } : c);
                                    localStorage.setItem('miré_desk_contacts', JSON.stringify(upd));
                                    return upd;
                                });
                            }
                            // Start Video Call if needed
                            if (localStream && sessionManagerFnRef.current) {
                                sessionManagerFnRef.current.startVideoCall(sessionId, session.remoteId, localStream);
                            }
                            return prev.map(s => s.id === sessionId ? { ...s, isAuthenticated: true, isAuthenticating: false } : s);
                        } else {
                            alert('Senha incorreta.');
                            return prev.map(s => s.id === sessionId ? { ...s, isAuthenticating: false, pendingPassword: undefined } : s);
                        }
                    }
                    else if (data.type === 'SOURCES_LIST') {
                        return prev.map(s => s.id === sessionId ? { ...s, remoteSources: data.sources, activeSourceId: data.activeSourceId } : s);
                    }
                    else if (data.type === 'MONITOR_CHANGED') {
                        return prev.map(s => s.id === sessionId ? { ...s, activeSourceId: data.activeSourceId } : s);
                    }
                }
                return prev;
            });
        });

    }, [localStream, onFileMessage, handleSessionClose, setContacts, setSessions]);

    const sessionManager = useSessionManager({
        serverIp,
        onSessionUpdate: useCallback((sessionId, updates) => {
            let shouldSetupListeners = false;
            let connToSetup = null;
            let sessionIncoming = false;

            setSessions(prev => {
                const newSessions = prev.map(s => {
                    if (s.id === sessionId) {
                        const updated = { ...s, ...updates };
                        if (updates.connected) updated.isAuthenticating = false;
                        return updated;
                    }
                    return s;
                });

                const session = newSessions.find(s => s.id === sessionId);
                if (session && updates.dataConnection) {
                    shouldSetupListeners = true;
                    connToSetup = updates.dataConnection;
                    sessionIncoming = session.isIncoming;
                }

                if (updates.connected && session && !session.isIncoming) {
                    setPendingSessionId(null);
                    setActiveSessionId(sessionId);
                }

                return newSessions;
            });

            if (shouldSetupListeners && connToSetup) {
                setupDataListeners(sessionId, connToSetup, sessionIncoming);
            }
        }, [setupDataListeners]),
        onSessionClose: handleSessionClose,
        onLog: (id, msg) => console.log(`[${id}] ${msg}`)
    });

    // Update ref whenever sessionManager changes
    useEffect(() => {
        sessionManagerFnRef.current = sessionManager;
    }, [sessionManager]);

    // Public API
    const connectTo = useCallback((remoteId: string) => {
        if (sessionsRef.current.some(s => s.remoteId === remoteId && !s.isIncoming)) {
            alert('Sessão já existe'); return;
        }

        const sessionId = `session-${Date.now()}`;
        const savedPw = contacts.find(c => c.id === remoteId)?.savedPassword;

        const newSession = createSession(sessionId, remoteId, false);
        newSession.pendingPassword = savedPw;
        newSession.shouldRememberPassword = !!savedPw;
        newSession.isConnecting = true;

        setSessions(prev => [...prev, newSession]);

        if (localStream) {
            sessionManager.connectToRemote(sessionId, remoteId, localStream);
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

    return {
        sessions, setSessions,
        activeSessionId, setActiveSessionId,
        pendingSessionId, setPendingSessionId,
        videoRefsMap,
        connectTo,
        sessionManager,
        handleSessionClose,
        setupDataListeners
    };
}
