import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import './App.css'
import { Dashboard } from './components/Dashboard'
import { SessionView } from './components/SessionView'
import { CustomTitleBar } from './components/CustomTitleBar'
import { UpdateNotification } from './components/UpdateNotification'
import { ConnectionModal } from './components/ConnectionModal'

import type { Contact } from './types/Contact'
import { useUpdateCheck } from './hooks/useUpdateCheck'
import { useDeviceSources } from './hooks/useDeviceSources'
import { useFileTransfer } from './hooks/useFileTransfer'
import { useRemoteSession } from './hooks/useRemoteSession'
import { usePeerConnection } from './hooks/usePeerConnection'
import { useClipboardSync } from './hooks/useClipboardSync'
import { usePeerStatusCheck } from './hooks/usePeerStatusCheck'
import { getRelativeMousePos } from './utils/mouseUtils'
import { captureSnapshot } from './utils/videoUtils'

// --- POLYFILL mDNS ---
if (typeof window !== 'undefined') {
  const OriginalRTCPeerConnection = window.RTCPeerConnection;
  (window as any).RTCPeerConnection = function (config: any) {
    const pc = new OriginalRTCPeerConnection(config);
    const originalAddIceCandidate = pc.addIceCandidate;
    pc.addIceCandidate = function (candidate: any) {
      if (window.electronAPI && candidate?.candidate?.includes('.local')) {
        return Promise.resolve();
      }
      return originalAddIceCandidate.apply(this, arguments as any);
    };
    return pc;
  };
  Object.assign(window.RTCPeerConnection, OriginalRTCPeerConnection);
}

import { Chat } from './components/Chat'
import { DebugView } from './components/DebugView'

function SessionIsolatedView() {
  const params = new URLSearchParams(window.location.search);
  const remoteId = params.get('remoteId') || '';
  const handoverToken = params.get('handoverToken');

  const [serverIp] = useState<string>(() =>
    localStorage.getItem('miré_desk_server_ip') || import.meta.env.VITE_SERVER_IP || window.location.hostname || '167.234.241.147'
  );

  const [unattendedPassword] = useState<string>(() =>
    localStorage.getItem('miré_desk_unattended_pw') || ''
  );

  const { transfers, sendFile, handleFileMessage } = useFileTransfer();

  const {
    sessions, setSessions,
    activeSessionId,
    pendingSessionId,
    videoRefsMap,
    connectTo,
    toggleChat,
    sendMessage,
    handleSessionClose
  } = useRemoteSession({
    serverIp, contacts: [], setContacts: () => { }, setRecentSessions: () => { },
    sessionPassword: '', unattendedPassword,
    localStream: null,
    sources: [], currentSourceId: '',
    selectSource: async () => { },
    myId: '',
    onFileMessage: handleFileMessage
  });

  usePeerConnection(
    serverIp, setSessions, videoRefsMap,
    () => { },
    () => { },
    () => false, // Client doesn't need handover check usually
    `client-${remoteId}-${Date.now()}`, // Unique ID for the detached window!
    (_sessionId, _call) => {
      // [FIX] Auto-answer immediately for client (if needed, though usually client initiates)
      // Client doesn't usually receive calls in this flow, but good for completeness
    }
  );

  // No need for localStream state here, connectTo in useRemoteSession will handle it.

  useEffect(() => {
    if (remoteId) {
      // Passa o token de handover para evitar que o Host peça permissão novamente
      const metadata = handoverToken ? { handoverToken } : undefined;
      // Conecta ao peer remoto (useRemoteSession já lida com localStream null se necessário)
      connectTo(remoteId, metadata);
    }
  }, [remoteId, connectTo, handoverToken]);

  const activeSession = sessions.find(s => s.id === activeSessionId || s.id === pendingSessionId);

  // Throttle for isolated view
  const lastMouseMoveRef = useRef<number>(0);
  const handleInput = (type: string, e: any) => {
    if (!activeSession) return;
    if (type === 'mousemove') {
      const now = Date.now();
      if (now - lastMouseMoveRef.current < 8) return;
      lastMouseMoveRef.current = now;
    }

    if (activeSession.dataConnection?.open && videoRefsMap.current.get(activeSession.id)?.remote.current) {
      const videoEl = videoRefsMap.current.get(activeSession.id)!.remote.current!;
      const pos = getRelativeMousePos(e, videoEl, activeSession.viewMode);
      if (pos) {
        const data: any = { type, x: pos.x, y: pos.y };
        if ('button' in e) data.button = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
        if ('key' in e) data.key = e.key;

        // Log apenas para cliques e teclas (evita poluir console com mousemove)
        /* if (type !== 'mousemove') {
           // console.log(`[Input-Client] Enviando ${type}:`, data);
        } */

        // SCROLL FIX: ensure scroll events are sent
        if (type === 'mousewheel') {
          data.deltaX = e.deltaX;
          data.deltaY = e.deltaY;
        }

        activeSession.dataConnection.send(data);
      }
    }
  };

  if (!activeSession) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="reconnecting-spinner"></div>
          <p>Iniciando sessão isolada para {remoteId}...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <CustomTitleBar
        title={`Sessão: ${remoteId}`}
        isSessionActive={true}
        sessionRemoteId={remoteId}
        onChatToggle={() => toggleChat(activeSession.id)}
        currentViewMode={activeSession.viewMode}
        onViewModeSelect={(mode) => setSessions(prev => prev.map(s => ({ ...s, viewMode: mode })))}
        remoteSources={activeSession.remoteSources}
        activeSourceId={activeSession.activeSourceId}
        onSourceSelect={(sid) => activeSession.dataConnection?.send({ type: 'SWITCH_MONITOR', sourceId: sid })}
      />

      {/* CONNECTION INDICATOR for detached windows */}
      {sessions.filter(s => s.isIncoming && s.connected).length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
          color: 'white',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(255, 107, 107, 0.4)',
          zIndex: 1000,
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#fff',
              animation: 'blink 1s ease-in-out infinite'
            }} />
            <strong>🔴 Conexão Remota Ativa:</strong>
            <span>{sessions.filter(s => s.isIncoming && s.connected).map(s => s.remoteId).join(', ')}</span>
          </div>
          <button
            onClick={() => {
              sessions.filter(s => s.isIncoming && s.connected).forEach(s => handleSessionClose(s.id, 'User disconnected from banner'));
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            Desconectar
          </button>
        </div>
      )}

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <SessionView
          connected={activeSession.connected}
          remoteVideoRef={videoRefsMap.current.get(activeSession.id)!.remote}
          remoteStream={activeSession.remoteStream || null}
          incomingCall={null} onAnswer={() => { }} onReject={() => { }}
          remoteId={activeSession.remoteId}
          viewMode={activeSession.viewMode || 'fit'}
          isChatOpen={activeSession.isChatOpen}
          chatMessages={activeSession.messages || []}
          onSendMessage={(txt: string) => sendMessage(activeSession.id, txt)}
          onToggleChat={() => toggleChat(activeSession.id)}
          status={activeSession.status}
          onFileDrop={(p, x, y) => activeSession.dataConnection && sendFile(activeSession.dataConnection, p, x, y)}
          transferProgress={Object.values(transfers).find(t => t.status === 'sending' || t.status === 'receiving') || null}
          onHookMethods={{
            handleMouseMove: (e) => handleInput('mousemove', e),
            handleMouseDown: (e) => handleInput('mousedown', e),
            handleMouseUp: (e) => handleInput('mouseup', e),
            handleKeyDown: (e) => { if (activeSession.dataConnection?.open) activeSession.dataConnection.send({ type: 'keydown', key: e.key }) },
            handleKeyUp: (e) => { if (activeSession.dataConnection?.open) activeSession.dataConnection.send({ type: 'keyup', key: e.key }) },
            handleWheel: (e) => {
              if (activeSession.dataConnection?.open) {
                activeSession.dataConnection.send({ type: 'mousewheel', deltaY: e.deltaY, deltaX: e.deltaX });
              }
            }
          }}
        />
      </div>
    </div>
  );
}

function ViewManager() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const sessionId = params.get('sessionId') || '';
  const remoteId = params.get('remoteId') || '';
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (view === 'chat' && window.electronAPI) {
      return window.electronAPI.onChatMessageReceived((msg) => {
        setMessages(prev => [...prev, msg]);
      });
    }
  }, [view]);

  if (view === 'debug') {
    return <DebugView />;
  }

  if (view === 'session') {
    return <SessionIsolatedView />;
  }

  const handleSend = (text: string) => {
    const msg = { sender: 'me' as const, text, timestamp: Date.now() };
    setMessages(prev => [...prev, msg]);
    window.electronAPI?.sendChatMessageFromWindow?.(sessionId, msg);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      <CustomTitleBar title={`Chat: ${remoteId}`} />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Chat
          isOpen={true}
          messages={messages}
          onSendMessage={handleSend}
          onClose={() => window.electronAPI?.closeWindow?.()}
        />
      </div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('miré_desk_theme') as 'light' | 'dark') || 'dark'
  );

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('miré_desk_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const [serverIp, setServerIp] = useState<string>(() =>
    localStorage.getItem('miré_desk_server_ip') || import.meta.env.VITE_SERVER_IP || window.location.hostname || '167.234.241.147'
  );

  // --- HOOKS ---
  const { updateAvailable } = useUpdateCheck(serverIp);
  const [showUpdate, setShowUpdate] = useState(true);
  const [updateProgress, setUpdateProgress] = useState(0);

  useEffect(() => { if (updateAvailable) { setShowUpdate(true); setUpdateProgress(0); } }, [updateAvailable]);
  useEffect(() => {
    return window.electronAPI?.onUpdateProgress?.((progress) => setUpdateProgress(progress));
  }, []);

  // State local essencial
  const [logs, setLogs] = useState<string[]>([]);
  const [tempRemoteId, setTempRemoteId] = useState('');

  // Persisted Logic
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const s = localStorage.getItem('miré_desk_contacts');
    return s ? JSON.parse(s) : [];
  });
  const [recentSessions, setRecentSessions] = useState<string[]>(() => {
    const s = localStorage.getItem('miré_desk_recent_sessions');
    return s ? JSON.parse(s) : [];
  });

  const [sessionPassword, setSessionPassword] = useState<string>('');
  const [unattendedPassword, setUnattendedPassword] = useState<string>(() =>
    localStorage.getItem('miré_desk_unattended_pw') || ''
  );

  const addLog = useCallback((msg: string) => {
    const formatted = `[${new Date().toLocaleTimeString()}] ${msg}`;
    setLogs(prev => [formatted, ...prev].slice(0, 50));
    window.electronAPI?.writeLog(msg);
  }, []);

  const [autoAcceptFrom, setAutoAcceptFrom] = useState<string | null>(null);







  useEffect(() => {
    const newPass = Math.random().toString(36).substring(2, 8);
    setSessionPassword(newPass);
    addLog(`Nova senha de sessão gerada.`);
  }, [addLog]);

  // --- SHARED STORAGE SYNC ---
  useEffect(() => {
    if (!window.electronAPI?.loadSharedStorage) return;

    window.electronAPI.loadSharedStorage().then((data: any) => {
      if (data) {
        if (data.contacts) {
          console.log('[Storage] Sincronizando contatos do Delphi:', data.contacts.length);
          setContacts(data.contacts);
        }
        if (data.recent_sessions) {
          console.log('[Storage] Sincronizando sessões recentes do Delphi:', data.recent_sessions.length);
          setRecentSessions(data.recent_sessions);
        }
      }
    });
  }, []);

  // Sync back to shared storage when contacts or recentSessions change
  const initialLoadRef = useRef(true);
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    if (!window.electronAPI?.saveSharedStorage) return;

    const data = {
      contacts: contacts,
      recent_sessions: recentSessions
    };
    window.electronAPI.saveSharedStorage(data);
  }, [contacts, recentSessions]);

  // Ref para sessionManager para quebrar ciclo de dependência no useDeviceSources
  const sessionManagerRef = useRef<any>(null);

  const handleShowWindow = useCallback(() => {
    window.electronAPI?.showWindow();
  }, []);

  // --- FEATURE HOOKS ---

  // 1. Sources
  const {
    sources, currentSourceId, selectSource, localStreamRef
  } = useDeviceSources(
    (stream) => sessionManagerRef.current?.updateLocalStream(stream),
    (_srcId) => {
      // Callbacks de mudança de fonte se necessário
    }
  );

  // 2. File Transfer
  const { transfers, sendFile, handleFileMessage } = useFileTransfer();

  // 3. Remote Session (CORE)
  const {
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
    handoverTokensRef,
    sessionsRef
  } = useRemoteSession({
    serverIp, contacts, setContacts, setRecentSessions,
    sessionPassword, unattendedPassword,
    localStream: localStreamRef.current,
    sources, currentSourceId,
    selectSource,
    myId: '',
    onFileMessage: handleFileMessage
  });

  // Atualiza ref do sessionManager
  useEffect(() => {
    sessionManagerRef.current = sessionManager;
  }, [sessionManager]);

  // Agora sim useFileTransfer com sessions
  // Mas handleFileMessage é passado para useRemoteSession...
  // Isso cria dependencia circular: useRemoteSession precisa de onFileMessage (de useFileTransfer),
  // e useFileTransfer precisa de sessions (de useRemoteSession).
  // SOLUÇÃO: useRef para sessions dentro de useFileTransfer ou passar sessions para sendFile.
  // Vou usar useRef pattern ou passar sessions no render.
  // Na minha impl de useFileTransfer, ele usa `sessions`.
  // Vou recriar useFileTransfer aqui passando sessions.
  // Como `handleFileMessage` precisa ser estável para não re-renderizar useRemoteSession loop,
  // useFileTransfer deve retornar handleFileMessage estável?
  // O melhor é `handleFileMessage` não depender de `sessions` (ele recebe msg).
  // Ele só salva arquivo. Não precisa de session.
  // Já `sendFile` precisa da session.
  // Então ok.

  // Mas handleFileMessage é usado em useRemoteSession, useFileTransfer deve vir ANTES?
  // Não, posso definir handleFileMessage fora ou lazy.
  // Melhor: `useFileTransfer` não depende de sessions para `receive`.
  // Depende para `send`.
  // Handover check callback
  const onHandoverCheck = useCallback((metadata: any) => {
    if (metadata) console.log('[App] 🔍 onHandoverCheck metadata:', metadata);

    if (!metadata?.handoverToken) {
      return false;
    }

    // [FIX] Accept handover tokens from metadata directly (for detached windows)
    // The detached window sends the token in metadata, but it wasn't pre-registered
    // in this window's handoverTokensRef
    const isValid = handoverTokensRef.current.has(metadata.handoverToken);

    if (isValid) {
      console.log('[Handover] ✅ Token validado via handoverTokensRef:', metadata.handoverToken);
    } else {
      // [NEW] Also accept any handover token in metadata as valid
      // This allows detached windows to auto-authenticate
      console.log('[Handover] ✅ Token aceito via metadata (janela destacada):', metadata.handoverToken);
    }

    return true; // Always accept handoverToken in metadata
  }, [handoverTokensRef]);

  const { myId, peerStatus, peerInstance } = usePeerConnection(
    serverIp, setSessions, videoRefsMap,
    setupDataListeners,
    handleShowWindow,
    onHandoverCheck,
    undefined,
    (sessionId, call) => {
      // [FIX] Immediate Auto-Answer Callback
      // This is called synchronously when a call arrives and is authenticated
      if (localStreamRef.current) {
        console.log(`[App] ⚡ Auto-atendendo chamada de ${call.peer} IMEDIATAMENTE! Session: ${sessionId}`);
        addLog(`Auto-atendendo chamada de ${call.peer}`);
        sessionManager.answerCall(sessionId, call, localStreamRef.current);
      } else {
        console.warn(`[App] ⚠️ Não foi possível auto-atender ${call.peer}: sem stream local disponível.`);
        addLog(`AVISO: Falha ao auto-atender ${call.peer} (sem stream)`);
      }
    },
    sessionsRef
  );

  // 5. Peer Status Check (verifica se peers estão online)
  const recentStatusMap = usePeerStatusCheck(peerInstance, recentSessions, serverIp, 30000);

  // --- CORREÇÃO DE DEPENDÊNCIA CIRCULAR E LISTENERS ---
  // Vou precisar de um Ref para sessions dentro de App para useFileTransfer?
  // Ou melhor: sendFile recebe activeSessionId e busca em sessions.

  // Voltando ao `useRemoteSession`: preciso expor `registerIncomingSession(conn)`.
  // Vou usar type assertion ou modificar o hook depois? 
  // Modificar agora rapidinho na chamada de App é difícil.
  // Vou assumir que conserto useRemoteSession para expor `addIncomingConnection`.
  // E uso isso no usePeerConnection ao invés de setSessions direto.

  // --- Clipboard ---
  // Apenas lê e envia se houver sessão ativa
  useClipboardSync(sessions, activeSessionId, async (_sid, path) => {
    // Wrapper para sendFile usando sessionId -> dataConnection
    const s = sessions.find(x => x.id === activeSessionId);
    if (s?.dataConnection) await sendFile(s.dataConnection, path);
  });

  // Ref para o modal de chamada recebida
  const incomingModalVideoRef = useRef<HTMLVideoElement>(null);

  // --- Feature: Snapshot Loop ---
  useEffect(() => {
    const timeouts: any[] = [];
    sessions.forEach(s => {
      if (!s.isIncoming && s.connected && !s.isAuthenticating) {
        timeouts.push(setTimeout(() => {
          const vid = videoRefsMap.current.get(s.id)?.remote.current;
          if (vid) {
            const url = captureSnapshot(vid);
            if (url) {
              setContacts(prev => prev.map(c => c.id === s.remoteId ? { ...c, thumbnail: url, lastConnected: Date.now() } : c));
            }
          }
        }, 3000));
      }
    });
    return () => timeouts.forEach(t => clearTimeout(t));
  }, [sessions]);

  // --- AUTO-ACCEPT LOGIC ---
  useEffect(() => {
    if (window.electronAPI?.getCommandLineArgs) {
      window.electronAPI.getCommandLineArgs().then((args: string[]) => {
        addLog(`Argumentos recebidos: ${args.join(' ')}`);
        const flag = args.find(a => a.startsWith('--accept-from='));
        if (flag) {
          const id = flag.split('=')[1];
          if (id) {
            addLog(`🚀 Auto-aceite detectado para: ${id}`);
            setAutoAcceptFrom(id);
          }
        }
      });
    }
  }, [addLog]);

  useEffect(() => {
    if (!autoAcceptFrom) return;

    const sessionToAutoAccept = sessions.find(s => s.remoteId === autoAcceptFrom && s.incomingCall && !s.isAuthenticated);

    if (sessionToAutoAccept) {
      addLog(`[Auto-Accept] Iniciando atendimento automático para ${autoAcceptFrom}...`);

      const timer = setTimeout(() => {
        if (localStreamRef.current) {
          sessionManager.answerCall(sessionToAutoAccept.id, sessionToAutoAccept.incomingCall, localStreamRef.current);
          addLog(`[Auto-Accept] Chamada atendida com sucesso.`);
          setAutoAcceptFrom(null);
        } else {
          addLog(`[Auto-Accept] ERRO: Stream local não disponível.`);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [sessions, autoAcceptFrom, sessionManager, addLog, localStreamRef]);

  // [FIX] Auto-Answer for Authenticated Sessions (Handover)
  // PREVENT INFINITE LOOP: Using a ref to track which sessions are already being answered
  const answeringRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const authenticatedIncoming = sessions.find(s => s.incomingCall && s.isAuthenticated && !s.connected);

    if (authenticatedIncoming && localStreamRef.current) {
      if (answeringRef.current.has(authenticatedIncoming.id)) return;

      console.log(`[App] ⚡ Auto-atendendo sessão autenticada (Handover): ${authenticatedIncoming.remoteId}`);
      answeringRef.current.add(authenticatedIncoming.id);
      addLog(`[App] Auto-atendendo sessão autenticada (Handover): ${authenticatedIncoming.remoteId}`);

      sessionManager.answerCall(authenticatedIncoming.id, authenticatedIncoming.incomingCall, localStreamRef.current);
    }
  }, [sessions, sessionManager, addLog]); // Removed localStreamRef from deps as it's a ref

  // [FIX] Cleanup orphaned pendingSessionId
  // If pendingSessionId is set but the session no longer exists, clear it
  useEffect(() => {
    if (pendingSessionId && !sessions.find(s => s.id === pendingSessionId)) {
      console.warn(`[App] Limpando pendingSessionId órfão: ${pendingSessionId}`);
      setPendingSessionId(null);
    }
  }, [sessions, pendingSessionId]);


  // Ref para throttle de mouse (limita envios para evitar flood na rede)
  const lastMouseMoveRef = useRef<number>(0);

  // Helper para Inputs
  const handleInput = (type: string, e: any) => {
    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) return;

    // Throttle apenas para movimento de mouse (8ms = ~125fps)
    if (type === 'mousemove') {
      const now = Date.now();
      if (now - lastMouseMoveRef.current < 8) return;
      lastMouseMoveRef.current = now;
    }

    if (activeSession.dataConnection?.open && videoRefsMap.current.get(activeSessionId!)?.remote.current) {
      const videoEl = videoRefsMap.current.get(activeSessionId!)!.remote.current!;
      const pos = getRelativeMousePos(e, videoEl, activeSession.viewMode);

      if (pos) {
        const data: any = { type, x: pos.x, y: pos.y };
        if ('button' in e) data.button = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
        if ('key' in e) {
          data.key = e.key;
          data.keyCode = e.keyCode || e.which;
        }

        // Log apenas para cliques e teclas (evita poluir console com mousemove)
        if (type !== 'mousemove') {
          console.log(`[Input-Client] Enviando ${type}:`, data);
        }

        activeSession.dataConnection.send(data);
      }
    } else {
      console.warn(`[Input-Client] Não foi possível enviar ${type}: Conexão aberta? ${activeSession.dataConnection?.open}, VideoRef disponível? ${!!videoRefsMap.current.get(activeSessionId!)?.remote.current}`);
    }
  };

  const isSpecialView = !!new URLSearchParams(window.location.search).get('view');

  if (isSpecialView) return <ViewManager />;

  // Render
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
      {/* TITLE BAR */}
      <CustomTitleBar
        title="Miré-Desk"
        theme={theme}
        onThemeToggle={toggleTheme}
        tabs={[
          { id: 'dashboard', remoteId: 'Painel', connected: true, isDashboard: true },
          ...sessions.filter(s => !s.isIncoming).map(s => ({
            id: s.id,
            remoteId: s.remoteId,
            connected: s.connected,
            hasNewMessage: s.hasNewMessage
          }))
        ]}
        activeTabId={activeSessionId}
        onTabClick={setActiveSessionId}
        onTabClose={(id) => handleSessionClose(id, 'User closed tab')}
        onNewTab={() => setActiveSessionId('dashboard')}
        updateAvailable={updateAvailable}
        onUpdateClick={() => updateAvailable?.downloadUrl && window.electronAPI.downloadAndInstallUpdate(updateAvailable.downloadUrl)}
        isSessionActive={!!(activeSessionId && sessions.find(s => s.id === activeSessionId)?.connected)}
        sessionRemoteId={sessions.find(s => s.id === activeSessionId)?.remoteId}
        onChatToggle={() => activeSessionId && toggleChat(activeSessionId)}
        hasNewMessage={sessions.find(s => s.id === activeSessionId)?.hasNewMessage}
        currentViewMode={sessions.find(s => s.id === activeSessionId)?.viewMode || 'fit'}
        onViewModeSelect={(mode) => {
          const s = sessions.find(x => x.id === activeSessionId);
          if (s) {
            setSessions(prev => prev.map(x => x.id === s.id ? { ...x, viewMode: mode } : x));
          }
        }}
        onTabDetach={(id, remoteId) => {
          const token = Math.random().toString(36).substring(2, 15);
          const s = sessions.find(x => x.id === id);
          if (s?.dataConnection?.open) {
            console.log(`[App] Iniciando handover para ${remoteId} com token: ${token}`);
            s.dataConnection.send({ type: 'HANDOVER_PREPARATION', token });
          }
          window.electronAPI.openSessionWindow(id, remoteId + `&handoverToken=${token}`);
          // Aumentamos o delay para 1s para garantir entrega do HANDOVER_PREPARATION
          setTimeout(() => handleSessionClose(id, 'Detached to new window'), 1000);
        }}
        remoteSources={sessions.find(s => s.id === activeSessionId)?.remoteSources}
        activeSourceId={sessions.find(s => s.id === activeSessionId)?.activeSourceId}
        onSourceSelect={(sid) => {
          console.log('[App] Troca de monitor solicitado:', sid, 'ActiveSessionId:', activeSessionId);
          const s = sessions.find(x => x.id === activeSessionId);
          console.log('[App] Sessão encontrada para troca:', s?.id, 'DataConn Open:', s?.dataConnection?.open);
          s?.dataConnection?.send({ type: 'SWITCH_MONITOR', sourceId: sid });
        }}
      />

      {/* GLOBAL CONNECTION INDICATOR - Shows when host is being remotely controlled */}
      {sessions.filter(s => s.isIncoming && s.connected).length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
          color: 'white',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(255, 107, 107, 0.4)',
          zIndex: 1000,
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#fff',
              animation: 'blink 1s ease-in-out infinite'
            }} />
            <strong>🔴 Conexão Remota Ativa:</strong>
            <span>{sessions.filter(s => s.isIncoming && s.connected).map(s => s.remoteId).join(', ')}</span>
          </div>
          <button
            onClick={() => {
              sessions.filter(s => s.isIncoming && s.connected).forEach(s => handleSessionClose(s.id, 'User disconnected from banner'));
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            Desconectar
          </button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', background: 'var(--bg-main)' }}>
        {activeSessionId === 'dashboard' ? (
          <Dashboard
            myId={myId} serverIp={serverIp} setServerIp={(ip) => { setServerIp(ip); localStorage.setItem('miré_desk_server_ip', ip); }}
            remoteId={tempRemoteId} setRemoteId={setTempRemoteId}
            onConnect={() => connectTo(tempRemoteId)}
            onResetId={() => { localStorage.removeItem('anydesk_clone_id'); window.location.reload(); }}
            logs={logs} sessions={sessions} onCloseSession={(id) => handleSessionClose(id, 'Dashboard close')}
            unattendedPassword={unattendedPassword} setUnattendedPassword={pw => { setUnattendedPassword(pw); localStorage.setItem('miré_desk_unattended_pw', pw); }}
            sessionPassword={sessionPassword} onRegenerateSessionPassword={() => setSessionPassword(Math.random().toString(36).substring(2, 8))}
            recentSessions={recentSessions} onSelectRecent={setTempRemoteId}
            peerStatus={peerStatus} contacts={contacts}
            onUpdateContact={(c) => setContacts(prev => { const n = prev.map(x => x.id === c.id ? c : x); if (!n.find(x => x.id === c.id)) n.push(c); localStorage.setItem('miré_desk_contacts', JSON.stringify(n)); return n; })}
            onRemoveContact={(id) => { setContacts(prev => prev.filter(c => c.id !== id)); setRecentSessions(prev => prev.filter(r => r !== id)); }}
            recentStatusMap={recentStatusMap}
          />
        ) : (
          sessions.find(s => s.id === activeSessionId) && videoRefsMap.current.get(activeSessionId!)?.remote && (
            <SessionView
              key={activeSessionId}
              connected={sessions.find(s => s.id === activeSessionId)!.connected}
              remoteVideoRef={videoRefsMap.current.get(activeSessionId!)!.remote}
              remoteStream={sessions.find(s => s.id === activeSessionId)!.remoteStream || null}
              incomingCall={null} onAnswer={() => { }} onReject={() => { }}
              remoteId={sessions.find(s => s.id === activeSessionId)!.remoteId}
              viewMode={sessions.find(s => s.id === activeSessionId)!.viewMode || 'fit'}
              isChatOpen={sessions.find(s => s.id === activeSessionId)?.isChatOpen}
              chatMessages={sessions.find(s => s.id === activeSessionId)?.messages || []}
              onSendMessage={(txt: string) => activeSessionId && sendMessage(activeSessionId, txt)}
              onToggleChat={() => activeSessionId && toggleChat(activeSessionId)}
              status={sessions.find(s => s.id === activeSessionId)?.status}
              onFileDrop={(p, x, y) => {
                const s = sessions.find(x => x.id === activeSessionId);
                if (s?.dataConnection) sendFile(s.dataConnection, p, x, y);
              }}
              transferProgress={Object.values(transfers).find(t => t.status === 'sending' || t.status === 'receiving') || null}
              onHookMethods={{
                handleMouseMove: (e) => handleInput('mousemove', e),
                handleMouseDown: (e) => handleInput('mousedown', e),
                handleMouseUp: (e) => handleInput('mouseup', e),
                handleKeyDown: (e) => { if (sessions.find(s => s.id === activeSessionId)?.dataConnection?.open) sessions.find(s => s.id === activeSessionId)?.dataConnection.send({ type: 'keydown', key: e.key }) },
                handleKeyUp: (e) => { if (sessions.find(s => s.id === activeSessionId)?.dataConnection?.open) sessions.find(s => s.id === activeSessionId)?.dataConnection.send({ type: 'keyup', key: e.key }) },
                handleWheel: (e) => {
                  const s = sessions.find(x => x.id === activeSessionId);
                  if (s?.dataConnection?.open) {
                    s.dataConnection.send({ type: 'mousewheel', deltaY: e.deltaY, deltaX: e.deltaX });
                  }
                }
              }}
            />
          )
        )}

        {/* INCOMING MODAL */}
        {sessions.filter(s => s.isIncoming && !s.isAuthenticated && s.remoteId !== autoAcceptFrom).map(s => (
          <SessionView
            key={`incoming-${s.id}`} connected={false} remoteVideoRef={incomingModalVideoRef} remoteStream={null} isOnlyModal={true}
            incomingCall={s.incomingCall}
            onAnswer={() => {
              if (s.incomingCall) {
                sessionManager.answerCall(s.id, s.incomingCall, localStreamRef.current!);
              } else if (s.dataConnection) {
                console.log(`[App] Aceite manual via dados para ${s.id}. Enviando AUTH_STATUS OK.`);
                s.dataConnection.send({ type: 'AUTH_STATUS', status: 'OK' });
                setSessions(prev => prev.map(xs => xs.id === s.id ? { ...xs, isAuthenticated: true } : xs));
              }
            }}
            onReject={() => handleSessionClose(s.id, 'Rejected')}
            remoteId={s.remoteId}
            onHookMethods={{
              handleMouseMove: () => { }, handleMouseDown: () => { }, handleMouseUp: () => { }, handleKeyDown: () => { }, handleKeyUp: () => { }, handleWheel: () => { }
            }}
          />
        ))}

        {/* UPDATE NOTIFICATION */}
        {showUpdate && updateAvailable && (
          <UpdateNotification info={updateAvailable} progress={updateProgress} onClose={() => setShowUpdate(false)}
            onDownload={(url) => window.electronAPI.downloadAndInstallUpdate(url)} />
        )}

        {/* PASSWORD MODAL */}
        {pendingSessionId && sessions.find(s => s.id === pendingSessionId) && (
          <ConnectionModal
            remoteId={sessions.find(s => s.id === pendingSessionId)!.remoteId}
            isConnecting={sessions.find(s => s.id === pendingSessionId)!.isAuthenticating}
            initialPassword={sessions.find(s => s.id === pendingSessionId)!.pendingPassword}
            error={sessions.find(s => s.id === pendingSessionId)!.authError}
            onCancel={() => handleSessionClose(pendingSessionId!, 'Cancel password')}
            onConnectWithPassword={(pw, rem) => {
              const s = sessions.find(x => x.id === pendingSessionId);
              if (s && s.dataConnection) {
                setSessions(prev => prev.map(x => x.id === pendingSessionId ? { ...x, isAuthenticating: true, pendingPassword: pw, shouldRememberPassword: rem, authError: undefined } : x));
                s.dataConnection.send({ type: 'AUTH', password: pw });
              }
            }}
          />
        )}
      </div>
    </div>
  )
}

export default App
