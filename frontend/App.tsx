import { useState, useEffect, useCallback, useRef } from 'react'
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

function ViewManager() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const sessionId = params.get('sessionId') || '';
  const remoteId = params.get('remoteId') || '';
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (view === 'chat') {
      return window.electronAPI.onChatMessageReceived((msg) => {
        setMessages(prev => [...prev, msg]);
      });
    }
  }, [view]);

  if (view === 'debug') {
    return <DebugView />;
  }

  const handleSend = (text: string) => {
    const msg = { sender: 'me' as const, text, timestamp: Date.now() };
    setMessages(prev => [...prev, msg]);
    window.electronAPI.sendChatMessageFromWindow(sessionId, msg);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <CustomTitleBar title={`Chat: ${remoteId}`} />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Chat
          isOpen={true}
          messages={messages}
          onSendMessage={handleSend}
          onClose={() => window.electronAPI.closeWindow()}
        />
      </div>
    </div>
  );
}

function App() {
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

  useEffect(() => {
    const newPass = Math.random().toString(36).substring(2, 8);
    setSessionPassword(newPass);
    addLog(`Nova senha de sessão gerada.`);
  }, [addLog]);

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
    pendingSessionId,
    videoRefsMap,
    connectTo,
    sessionManager,
    handleSessionClose,
    setupDataListeners,
    sendMessage,
    toggleChat
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

  // Re-declare FileTransfer passing sessions
  // Mas como handleFileMessage é usado em useRemoteSession, useFileTransfer deve vir ANTES?
  // Não, posso definir handleFileMessage fora ou lazy.
  // Melhor: `useFileTransfer` não depende de sessions para `receive`.
  // Depende para `send`.
  // Vou usar o hook aqui.

  const { myId, peerStatus, peerInstance } = usePeerConnection(
    serverIp, setSessions, videoRefsMap,
    setupDataListeners,
    handleShowWindow
  );

  // 5. Peer Status Check (verifica se peers estão online)
  const recentStatusMap = usePeerStatusCheck(peerInstance, recentSessions, 30000);

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
        if ('key' in e) data.key = e.key;

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#000' }}>
      {/* TITLE BAR */}
      <CustomTitleBar
        title="Miré-Desk"
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
        remoteSources={sessions.find(s => s.id === activeSessionId)?.remoteSources}
        activeSourceId={sessions.find(s => s.id === activeSessionId)?.activeSourceId}
        onSourceSelect={(sid) => {
          console.log('[App] Troca de monitor solicitado:', sid, 'ActiveSessionId:', activeSessionId);
          const s = sessions.find(x => x.id === activeSessionId);
          console.log('[App] Sessão encontrada para troca:', s?.id, 'DataConn Open:', s?.dataConnection?.open);
          s?.dataConnection?.send({ type: 'SWITCH_MONITOR', sourceId: sid });
        }}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
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
                handleKeyUp: (e) => { if (sessions.find(s => s.id === activeSessionId)?.dataConnection?.open) sessions.find(s => s.id === activeSessionId)?.dataConnection.send({ type: 'keyup', key: e.key }) }
              }}
            />
          )
        )}

        {/* INCOMING MODAL */}
        {sessions.find(s => s.incomingCall && !s.isAuthenticated) && (
          <SessionView
            key="incoming" connected={false} remoteVideoRef={incomingModalVideoRef} remoteStream={null} isOnlyModal={true}
            incomingCall={sessions.find(s => s.incomingCall && !s.isAuthenticated)!.incomingCall}
            onAnswer={() => sessionManager.answerCall(sessions.find(s => s.incomingCall && !s.isAuthenticated)!.id, sessions.find(s => s.incomingCall && !s.isAuthenticated)!.incomingCall, localStreamRef.current!)}
            onReject={() => handleSessionClose(sessions.find(s => s.incomingCall && !s.isAuthenticated)!.id, 'Rejected')}
            remoteId={sessions.find(s => s.incomingCall && !s.isAuthenticated)!.remoteId}
            onHookMethods={{
              handleMouseMove: () => { }, handleMouseDown: () => { }, handleMouseUp: () => { }, handleKeyDown: () => { }, handleKeyUp: () => { }
            }}
          />
        )}

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
            onCancel={() => handleSessionClose(pendingSessionId!, 'Cancel password')}
            onConnectWithPassword={(pw, rem) => {
              const s = sessions.find(x => x.id === pendingSessionId);
              if (s && s.dataConnection) {
                setSessions(prev => prev.map(x => x.id === pendingSessionId ? { ...x, isAuthenticating: true, pendingPassword: pw, shouldRememberPassword: rem } : x));
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
