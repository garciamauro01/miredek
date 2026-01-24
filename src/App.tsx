import { useState, useEffect, useRef, createRef, useCallback } from 'react'
import Peer from 'peerjs'
import './App.css'
import { Dashboard } from './components/Dashboard'
import { SessionView } from './components/SessionView'
import { TabBar } from './components/TabBar'
import type { Session } from './types/Session'
import { createSession } from './types/Session'
import { useSessionManager } from './hooks/useSessionManager'
import type { Contact } from './types/Contact'

declare global {
  interface Window {
    electronAPI: {
      getSources: () => Promise<any[]>;
      executeInput: (data: any) => Promise<void>;
      getAutostartStatus: () => Promise<boolean>;
      setAutostart: (value: boolean) => Promise<boolean>;
      showWindow: () => Promise<void>;
      writeClipboard: (text: string) => Promise<void>;
      readClipboard: () => Promise<string>;
      readFileChunk: (path: string, start: number, size: number) => Promise<Uint8Array>;
      saveFileChunk: (transferId: string, chunk: Uint8Array) => Promise<boolean>;
      finalizeFile: (transferId: string, fileName: string, x?: number, y?: number) => Promise<string>;
      getFileInfo: (path: string) => Promise<{ name: string; size: number; path: string }>;
      getAppVersion: () => Promise<string>;
      writeLog: (text: string) => Promise<void>;
    }
  }
}

interface FileTransferState {
  id: string;
  name: string;
  size: number;
  received: number;
  status: 'sending' | 'receiving' | 'completed' | 'error';
  progress: number;
}

// --- POLYFILL/INTERCEPTOR PARA ELIMINAR ERRO mDNS (-105) ---
if (typeof window !== 'undefined') {
  const OriginalRTCPeerConnection = window.RTCPeerConnection;
  (window as any).RTCPeerConnection = function (config: any) {
    const pc = new OriginalRTCPeerConnection(config);
    const originalAddIceCandidate = pc.addIceCandidate;

    pc.addIceCandidate = function (candidate: any) {
      if (window.electronAPI && candidate && candidate.candidate && candidate.candidate.includes('.local')) {
        return Promise.resolve();
      }
      return originalAddIceCandidate.apply(this, arguments as any);
    };
    return pc;
  };
  Object.assign(window.RTCPeerConnection, OriginalRTCPeerConnection);
}

function App() {
  const [myId, setMyId] = useState<string>('')
  const [serverIp, setServerIp] = useState<string>(() => {
    return localStorage.getItem('miré_desk_server_ip') || window.location.hostname || 'localhost';
  })

  // Multi-session state
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>('dashboard')
  const [sources, setSources] = useState<any[]>([])
  const [currentSourceId, setCurrentSourceId] = useState<string>('')
  const sourcesRef = useRef(sources);
  const currentSourceIdRef = useRef(currentSourceId);

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => {
    currentSourceIdRef.current = currentSourceId;
  }, [currentSourceId]);

  const [tempRemoteId, setTempRemoteId] = useState('')
  const workingEndpointRef = useRef<string | null>(null)
  const blockedEndpointsRef = useRef<Set<string>>(new Set())

  // Passwords and History
  const [unattendedPassword, setUnattendedPassword] = useState<string>(() => {
    return localStorage.getItem('miré_desk_unattended_pw') || '';
  })
  const [tempPassword, setTempPassword] = useState<string>('')
  const unattendedPasswordRef = useRef(unattendedPassword);
  const tempPasswordRef = useRef(tempPassword);

  useEffect(() => {
    unattendedPasswordRef.current = unattendedPassword;
  }, [unattendedPassword]);

  useEffect(() => {
    tempPasswordRef.current = tempPassword;
  }, [tempPassword]);

  const [recentSessions, setRecentSessions] = useState<string[]>(() => {
    const saved = localStorage.getItem('miré_desk_recent_sessions');
    return saved ? JSON.parse(saved) : [];
  })
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const saved = localStorage.getItem('miré_desk_contacts');
    return saved ? JSON.parse(saved) : [];
  })

  // Peer Status
  const [peerStatus, setPeerStatus] = useState<'online' | 'offline' | 'connecting'>('connecting')

  // Transfência de Arquivos
  const [transfers, setTransfers] = useState<{ [key: string]: FileTransferState }>({});
  const transferNamesRef = useRef<{ [key: string]: string }>({});

  // Status das sessões recentes
  const [recentStatusMap, setRecentStatusMap] = useState<{ [id: string]: 'online' | 'offline' | 'checking' }>({});
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    const formatted = `[${new Date().toLocaleTimeString()}] ${msg}`;
    setLogs(prev => [formatted, ...prev].slice(0, 50));
    // Persiste no arquivo via Electron
    if (window.electronAPI?.writeLog) {
      window.electronAPI.writeLog(msg);
    }
  }, []);

  const captureSnapshot = useCallback((sessionId: string, remoteId: string) => {
    const refs = videoRefsMap.current.get(sessionId);
    if (!refs?.remote?.current) return;

    const video = refs.remote.current;
    if (video.videoWidth === 0) return; // Vídeo ainda não carregou frames

    try {
      const canvas = document.createElement('canvas');
      // Redimensionamos para um tamanho pequeno para não estourar o localStorage (ex: 320px largura)
      const scale = 320 / video.videoWidth;
      canvas.width = 320;
      canvas.height = video.videoHeight * scale;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // JPEG com 70% qualidade

        setContacts(prev => {
          const contact = prev.find(c => c.id === remoteId);
          if (contact) {
            const updated = { ...contact, thumbnail: dataUrl, lastConnected: Date.now() };
            const newContacts = prev.map(c => c.id === remoteId ? updated : c);
            localStorage.setItem('miré_desk_contacts', JSON.stringify(newContacts));
            return newContacts;
          }
          return prev;
        });
      }
    } catch (e) {
      console.error('Erro ao capturar snapshot:', e);
    }
  }, []);

  useEffect(() => {
    addLog(`App iniciado. MyID: ${myId || 'pendente'}, Server: ${serverIp}`);
  }, [myId, serverIp, addLog]);

  useEffect(() => {
    // Se estiver no modo cloud ou sem IPs recentes, não faz polling de status via HTTP
    if (serverIp === 'cloud' || (!recentSessions.length && peerStatus !== 'online')) {
      if (serverIp === 'cloud') {
        const offlineMap: typeof recentStatusMap = {};
        recentSessions.forEach(id => offlineMap[id] = 'offline');
        setRecentStatusMap(offlineMap);
      }
      return;
    }

    const checkStatuses = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        // Tentamos endpoints comuns do PeerJS Server
        // 1. /peers (padrão em muitas configs)
        // 2. /peerjs/peers (se o path for /peerjs)
        // 3. /peerjs/peerjs/peers (comum em algumas instâncias gerenciadas)
        const endpoints = workingEndpointRef.current
          ? [workingEndpointRef.current]
          : [
            `http://${serverIp}:9000/peerjs/peers`,
            `http://${serverIp}:9000/peers`
          ];

        let peersList: string[] = [];
        let success = false;

        for (const url of endpoints) {
          if (blockedEndpointsRef.current.has(url)) continue;

          try {
            const response = await fetch(url, { signal: controller.signal });
            if (response.ok) {
              peersList = await response.json();
              success = true;
              workingEndpointRef.current = url;
              break;
            } else if (response.status === 401 || response.status === 404) {
              // Se deu 401 ou 404, não tentamos mais esse endpoint para não poluir o console
              if (!workingEndpointRef.current) {
                blockedEndpointsRef.current.add(url);
              }
            }
          } catch (e: any) {
            continue;
          }
        }

        clearTimeout(timeoutId);

        if (!success) {
          if (recentSessions.length === 0) return;
          // Fallback: Tenta checar um por um usando o endpoint /:key/:id/online
          const newStatusMap: typeof recentStatusMap = {};

          await Promise.all(recentSessions.map(async (id) => {
            const testUrls = [
              `http://${serverIp}:9000/peerjs/${id}/online`,
              `http://${serverIp}:9000/${id}/online`,
              `http://${serverIp}:9000/peerjs/online/${id}`,
              `http://${serverIp}:9000/online/${id}`
            ];

            let isOnline = false;
            for (const url of testUrls) {
              try {
                const res = await fetch(url, { signal: controller.signal });
                if (res.ok) {
                  const data = await res.json();
                  if (data.online) {
                    isOnline = true;
                    break;
                  }
                }
              } catch (e) {
                continue;
              }
            }
            newStatusMap[id] = isOnline ? 'online' : 'offline';
          }));

          setRecentStatusMap(newStatusMap);
          return;
        }

        const newStatusMap: typeof recentStatusMap = {};
        recentSessions.forEach(id => {
          // O ID na lista do server geralmente é string. 
          // Às vezes o peerjs-server retorna um array de objetos [{id: '...'}, ...]
          const isOnline = peersList.some((p: any) => {
            const peerId = typeof p === 'string' ? p : p.id;
            return peerId === id;
          });
          newStatusMap[id] = isOnline ? 'online' : 'offline';
        });

        setRecentStatusMap(newStatusMap);

      } catch (e: any) {
        addLog(`Erro geral no status polling: ${e.message}`);
        // Se falhar o fetch, marca todos os recentes como offline para não dar falso positivo
        const offlineMap: typeof recentStatusMap = {};
        recentSessions.forEach(id => {
          offlineMap[id] = 'offline';
        });
        setRecentStatusMap(offlineMap);
      }
    };

    checkStatuses();
    const interval = setInterval(checkStatuses, 5000); // 5s para ser mais responsivo
    return () => clearInterval(interval);
  }, [recentSessions, serverIp, myId, peerStatus]);

  // Shared local stream (screen capture)
  const localStreamRef = useRef<MediaStream | null>(null)
  const mainPeerRef = useRef<Peer | null>(null)

  // Funções de Transferência
  const sendFile = async (sessionId: string, filePath: string, x?: number, y?: number) => {
    if (!window.electronAPI) return;

    const activeSession = sessions.find(s => s.id === sessionId);
    if (!activeSession || !activeSession.dataConnection) return;

    try {
      const fileInfo = await window.electronAPI.getFileInfo(filePath);
      const transferId = `tf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      setTransfers(prev => ({
        ...prev,
        [transferId]: { id: transferId, name: fileInfo.name, size: fileInfo.size, received: 0, status: 'sending', progress: 0 }
      }));

      activeSession.dataConnection.send({
        type: 'FILE_START',
        transferId,
        name: fileInfo.name,
        size: fileInfo.size,
        dropX: x,
        dropY: y
      });

      const CHUNK_SIZE = 64 * 1024; // 64KB
      let offset = 0;

      while (offset < fileInfo.size) {
        const size = Math.min(CHUNK_SIZE, fileInfo.size - offset);
        const chunk = await window.electronAPI.readFileChunk(filePath, offset, size);

        activeSession.dataConnection.send({
          type: 'FILE_CHUNK',
          transferId,
          chunk
        });

        offset += size;
        const progress = Math.round((offset / fileInfo.size) * 100);
        setTransfers(prev => ({
          ...prev,
          [transferId]: { ...prev[transferId], received: offset, progress }
        }));

        // Pequeno delay para não sobrecarregar o canal de dados
        if (offset % (CHUNK_SIZE * 10) === 0) {
          await new Promise(r => setTimeout(r, 10));
        }
      }

      activeSession.dataConnection.send({ type: 'FILE_END', transferId });
      setTransfers(prev => ({
        ...prev,
        [transferId]: { ...prev[transferId], status: 'completed', progress: 100 }
      }));

    } catch (err) {
      console.error('Erro no envio de arquivo:', err);
    }
  };

  // videoRefsMap per session
  const videoRefsMap = useRef<Map<string, {
    remote: React.RefObject<HTMLVideoElement | null>;
  }>>(new Map())

  // --- Sincronização de Clipboard ---
  const lastClipboardRef = useRef<string>('');

  useEffect(() => {
    if (!window.electronAPI) return;

    const pollClipboard = async () => {
      // Monitora se houver sessão ativa conectada
      const activeSession = sessions.find(s => s.id === activeSessionId && s.connected);
      if (!activeSession) return;

      try {
        const currentText = await window.electronAPI.readClipboard();
        if (currentText && currentText !== lastClipboardRef.current) {
          lastClipboardRef.current = currentText;

          // Detecção de arquivo no clipboard
          if (currentText.match(/^[a-zA-Z]:\\.*$/) || currentText.startsWith('/') || currentText.startsWith('\\\\')) {
            try {
              const info = await (window as any).electronAPI.getFileInfo(currentText);
              if (info && info.size > 0) {
                console.log('Arquivo detectado no clipboard, enviando:', info.path);
                await sendFile(activeSession.id, info.path);
                return;
              }
            } catch (e) { /* fallback para texto */ }
          }

          if (activeSession.dataConnection && activeSession.dataConnection.open) {
            activeSession.dataConnection.send({
              type: 'CLIPBOARD',
              text: currentText
            });
            console.log('Clipboard enviado:', currentText.substring(0, 20) + '...');
          }
        }
      } catch (err) {
        // Ignora erros silenciosos de leitura
      }
    };

    const interval = setInterval(pollClipboard, 1500);
    return () => clearInterval(interval);
  }, [sessions, activeSessionId]);

  // --- Lógica de Captura ---
  const selectSource = async (sourceId: string) => {
    try {
      let stream: MediaStream
      if (sourceId === 'browser' || !window.electronAPI) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        })
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              minWidth: 1280,
              maxWidth: 1920,
              minHeight: 720,
              maxHeight: 1080
            }
          }
        } as any)
      }

      localStreamRef.current = stream
      setCurrentSourceId(sourceId)
      sessionManager.updateLocalStream(stream)

      setSessions(prev => {
        prev.forEach(s => {
          if (s.isIncoming && s.dataConnection && s.dataConnection.open) {
            s.dataConnection.send({
              type: 'MONITOR_CHANGED',
              activeSourceId: sourceId
            });
          }
        });
        return prev;
      });
    } catch (e) {
      console.error('Erro ao capturar tela:', e)
    }
  }

  // --- Função auxiliar para cálculo de mouse preciso ---
  const getRelativeMousePos = (e: React.MouseEvent, videoElement: HTMLVideoElement | null, viewMode: 'fit' | 'original' | 'stretch' = 'fit') => {
    const video = videoElement;
    if (!video || video.videoWidth === 0) return null;

    const rect = video.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let finalX = 0;
    let finalY = 0;

    if (viewMode === 'stretch') {
      finalX = x / video.clientWidth;
      finalY = y / video.clientHeight;
    } else if (viewMode === 'original') {
      finalX = x / video.videoWidth;
      finalY = y / video.videoHeight;
    } else {
      // Modo Fit (contain)
      const videoRatio = video.videoWidth / video.videoHeight;
      const elementRatio = video.clientWidth / video.clientHeight;

      let actualWidth, actualHeight, offsetX, offsetY;

      if (elementRatio > videoRatio) {
        // Pilar (barras laterais)
        actualHeight = video.clientHeight;
        actualWidth = actualHeight * videoRatio;
        offsetX = (video.clientWidth - actualWidth) / 2;
        offsetY = 0;
      } else {
        // Letterbox (barras superior/inferior)
        actualWidth = video.clientWidth;
        actualHeight = actualWidth / videoRatio;
        offsetX = 0;
        offsetY = (video.clientHeight - actualHeight) / 2;
      }

      finalX = (x - offsetX) / actualWidth;
      finalY = (y - offsetY) / actualHeight;
    }

    if (finalX < 0 || finalX > 1 || finalY < 0 || finalY > 1) return null;
    return { x: finalX, y: finalY };
  };

  // --- Lógica de Canal de Dados ---
  const setupDataListeners = useCallback((sessionId: string, conn: any, isIncoming: boolean) => {
    if (!conn) return;

    // Envia lista de fontes inicial se for Host
    const sendSourcesList = () => {
      if (isIncoming && conn.open) {
        conn.send({
          type: 'SOURCES_LIST',
          sources: sourcesRef.current,
          activeSourceId: currentSourceIdRef.current
        });
      }
    };

    if (conn.open) sendSourcesList();
    else conn.on('open', sendSourcesList);

    conn.on('data', async (data: any) => {
      console.log(`Dados na sessão ${sessionId}:`, data);

      if (data && data.type === 'CLIPBOARD') {
        if (window.electronAPI) {
          lastClipboardRef.current = data.text;
          window.electronAPI.writeClipboard(data.text);
          console.log('Clipboard recebido e atualizado');
        }
        return;
      }

      // --- LOGICA DE RECEBIMENTO DE ARQUIVO ---
      if (data.type === 'FILE_START') {
        const { transferId, name, size, dropX, dropY } = data;
        transferNamesRef.current[transferId] = name;
        // Armazenamos as coordenadas temporariamente vinculadas ao transferId
        (window as any)[`coords_${transferId}`] = { x: dropX, y: dropY };

        setTransfers(prev => ({
          ...prev,
          [transferId]: { id: transferId, name, size, received: 0, status: 'receiving', progress: 0 }
        }));
        return;
      }

      if (data.type === 'FILE_CHUNK') {
        const { transferId, chunk } = data;
        if (window.electronAPI) {
          await window.electronAPI.saveFileChunk(transferId, chunk);
          setTransfers(prev => {
            const t = prev[transferId];
            if (!t) return prev;
            const received = t.received + chunk.length;
            const progress = Math.round((received / t.size) * 100);
            return {
              ...prev,
              [transferId]: { ...t, received, progress }
            };
          });
        }
        return;
      }

      if (data.type === 'FILE_END') {
        const { transferId } = data;
        const name = transferNamesRef.current[transferId];
        const coords = (window as any)[`coords_${transferId}`];

        if (name && window.electronAPI) {
          const finalPath = await window.electronAPI.finalizeFile(transferId, name, coords?.x, coords?.y);
          delete (window as any)[`coords_${transferId}`];
          setTransfers(prev => ({
            ...prev,
            [transferId]: { ...prev[transferId], status: 'completed', progress: 100 }
          }));
          console.log(`Arquivo salvo em: ${finalPath}`);
          delete transferNamesRef.current[transferId];
        }
        return;
      }
      setSessions(prev => {
        const session = prev.find(s => s.id === sessionId);
        if (!session) return prev;

        if (session.isIncoming) {
          if (data && data.type === 'AUTH') {
            const isCorrect = !!(unattendedPasswordRef.current && data.password === unattendedPasswordRef.current);
            conn.send({ type: 'AUTH_STATUS', status: isCorrect ? 'OK' : 'FAIL' });
            return prev.map(s => s.id === sessionId ? { ...s, isAuthenticated: isCorrect } : s);
          } else if (data && data.type === 'SWITCH_MONITOR') {
            selectSource(data.sourceId);
          } else if (data && data.type && ['mousemove', 'mousedown', 'mouseup', 'keydown', 'keyup'].includes(data.type)) {
            if (window.electronAPI) {
              const activeSource = sourcesRef.current.find(s => s.id === currentSourceIdRef.current);
              window.electronAPI.executeInput({
                ...data,
                activeSourceBounds: activeSource ? activeSource.bounds : null
              });
            }
          }
        } else {
          if (data && data.type === 'AUTH_STATUS') {
            if (data.status === 'OK') {
              if (localStreamRef.current) {
                // Salva no histórico ao autenticar com sucesso
                setRecentSessions(old => {
                  const filtered = old.filter(id => id !== session.remoteId);
                  const newRecent = [session.remoteId, ...filtered].slice(0, 10);
                  localStorage.setItem('miré_desk_recent_sessions', JSON.stringify(newRecent));
                  return newRecent;
                });
                sessionManager.startVideoCall(sessionId, session.remoteId, localStreamRef.current);
              }
              return prev.map(s => s.id === sessionId ? { ...s, isAuthenticated: true, isAuthenticating: false } : s);
            } else {
              alert('Senha incorreta.');
              return prev.map(s => s.id === sessionId ? { ...s, isAuthenticating: false } : s);
            }
          } else if (data && data.type === 'SOURCES_LIST') {
            return prev.map(s =>
              s.id === sessionId ? { ...s, remoteSources: data.sources, activeSourceId: data.activeSourceId } : s
            );
          } else if (data && data.type === 'MONITOR_CHANGED') {
            return prev.map(s =>
              s.id === sessionId ? { ...s, activeSourceId: data.activeSourceId } : s
            );
          }
        }
        return prev;
      });
    });

    if (conn.open && !sessions.find(s => s.id === sessionId)?.isIncoming && tempPasswordRef.current) {
      conn.send({ type: 'AUTH', password: tempPasswordRef.current });
    } else {
      conn.on('open', () => {
        const s = sessions.find(sess => sess.id === sessionId);
        if (s && !s.isIncoming && tempPasswordRef.current) {
          conn.send({ type: 'AUTH', password: tempPasswordRef.current });
        }
      });
    }
  }, [sessions]); // unattendedPasswordRef não precisa estar nas deps pois usamos Ref

  // Session manager
  const sessionManager = useSessionManager({
    serverIp,
    onSessionUpdate: (sessionId, updates) => {
      setSessions(prev => {
        const newSessions = prev.map(s => s.id === sessionId ? { ...s, ...updates } : s);
        const session = newSessions.find(s => s.id === sessionId);
        if (session && updates.dataConnection) {
          setupDataListeners(sessionId, updates.dataConnection, session.isIncoming);
        }
        return newSessions;
      })
    },
    onSessionClose: (sessionId, reason) => {
      console.log(`[${sessionId}] Sessão encerrada: ${reason}`);
      setSessions(prev => {
        const session = prev.find(s => s.id === sessionId);
        if (!session) return prev;

        // Notifica o usuário
        alert(`Conexão com ${session.remoteId} foi encerrada.\nRazão: ${reason}`);

        // Limpa referências de vídeo
        videoRefsMap.current.delete(sessionId);

        // Remove a sessão
        const remaining = prev.filter(s => s.id !== sessionId);

        // Ajusta aba ativa se necessário
        if (activeSessionId === sessionId) {
          const outgoingRemaining = remaining.filter(s => !s.isIncoming);
          if (outgoingRemaining.length > 0) {
            setActiveSessionId(outgoingRemaining[0].id);
          } else {
            setActiveSessionId('dashboard');
          }
        }

        return remaining;
      });
    },
    onLog: (sessionId, message) => {
      console.log(`[${sessionId}] ${message}`)
    }
  })

  // Initialize main Peer
  useEffect(() => {
    let fixedId = localStorage.getItem('anydesk_clone_id')
    if (!fixedId) {
      fixedId = Math.floor(100000000 + Math.random() * 900000000).toString()
      localStorage.setItem('anydesk_clone_id', fixedId)
    }

    const peerConfig = serverIp === 'cloud' ? {
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    } : {
      host: serverIp, port: 9000, path: '/',
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    }

    console.log('[App] Inicializando Peer com config:', JSON.stringify(peerConfig, null, 2));
    addLog(`Conectando a: ${serverIp === 'cloud' ? 'Cloud' : `${peerConfig.host}:${peerConfig.port}`}`);

    const mainPeer = new Peer(fixedId, peerConfig)
    mainPeerRef.current = mainPeer
    setPeerStatus('connecting')

    mainPeer.on('open', (id) => {
      setMyId(id);
      setPeerStatus('online');
    })

    mainPeer.on('error', (err) => {
      console.error('[Host] Peer error:', err);
      setPeerStatus('offline');
      if (err.type === 'unavailable-id') {
        localStorage.removeItem('anydesk_clone_id');
        setTimeout(() => window.location.reload(), 1000);
      }
    })

    mainPeer.on('connection', (conn) => {
      setSessions(prev => {
        const session = prev.find(s => s.remoteId === conn.peer);
        if (session) {
          setupDataListeners(session.id, conn, true);
          return prev.map(s => s.id === session.id ? { ...s, dataConnection: conn, isIncoming: true } : s);
        } else {
          // Acesso não supervisionado: cria sessão automaticamente para nova conexão de dados
          const newId = `session-${Date.now()}`;
          const newSession = createSession(newId, conn.peer, true);
          newSession.dataConnection = conn;
          videoRefsMap.current.set(newId, { remote: createRef<HTMLVideoElement>() });
          setupDataListeners(newId, conn, true);
          return [...prev, newSession];
        }
      });
    });

    mainPeer.on('call', (call) => {
      setSessions(prev => {
        const existingSession = prev.find(s => s.remoteId === call.peer && !s.incomingCall);
        if (existingSession) {
          // Se já existe uma sessão de dados desse peer, anexa a chamada a ela
          return prev.map(s => s.id === existingSession.id ? { ...s, incomingCall: call } : s);
        }
        // Caso contrário, cria nova sessão
        const newSessionId = `session-${Date.now()}`
        const newSession = createSession(newSessionId, call.peer, true)
        newSession.incomingCall = call
        if (!videoRefsMap.current.has(newSessionId)) {
          videoRefsMap.current.set(newSessionId, { remote: createRef<HTMLVideoElement>() })
        }
        if (window.electronAPI) window.electronAPI.showWindow();
        return [...prev, newSession];
      });
    });

    if (window.electronAPI) {
      window.electronAPI.getSources().then(availableSources => {
        setSources(availableSources)
        if (availableSources.length > 0) {
          const primary = availableSources.find(s => s.isPrimary)
          selectSource(primary ? primary.id : availableSources[0].id)
        }
      });
    }

    return () => mainPeer.destroy()
  }, [serverIp])

  const handleConnect = async () => {
    if (!tempRemoteId) return;

    if (!localStreamRef.current) {
      if (!window.electronAPI) await selectSource('browser');
      else { alert('Selecione uma tela!'); return; }
    }

    const sessionId = `session-${Date.now()}`
    const newSession = createSession(sessionId, tempRemoteId, false)
    videoRefsMap.current.set(sessionId, { remote: createRef<HTMLVideoElement>() })

    setSessions(prev => [...prev, newSession])
    setActiveSessionId(sessionId)

    if (tempPassword) {
      sessionManager.connectDataOnly(sessionId, tempRemoteId);
    } else {
      // Se não tem senha, adiciona ao histórico e garante que existe nos contatos
      setRecentSessions(old => {
        const filtered = old.filter(id => id !== tempRemoteId);
        const newRecent = [tempRemoteId, ...filtered].slice(0, 10);
        localStorage.setItem('miré_desk_recent_sessions', JSON.stringify(newRecent));
        return newRecent;
      });

      setContacts(prev => {
        if (!prev.find(c => c.id === tempRemoteId)) {
          const newContacts = [...prev, { id: tempRemoteId, isFavorite: false }];
          localStorage.setItem('miré_desk_contacts', JSON.stringify(newContacts));
          return newContacts;
        }
        return prev;
      });

      sessionManager.connectToRemote(sessionId, tempRemoteId, localStreamRef.current!);
      setActiveSessionId(sessionId);
    }
  }

  const handleAnswerCall = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session || !session.incomingCall) return;
    if (!localStreamRef.current) {
      if (!window.electronAPI) await selectSource('browser');
      else { alert('Selecione uma tela!'); return; }
    }
    if (localStreamRef.current) {
      sessionManager.answerCall(sessionId, session.incomingCall, localStreamRef.current)
    }
  }

  const handleRejectCall = (sessionId: string) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, incomingCall: null } : s))
    sessionManager.closeSession(sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  }

  const closeSession = (sessionId: string) => {
    if (confirm('Deseja fechar esta sessão?')) {
      sessionManager.closeSession(sessionId)
      videoRefsMap.current.delete(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (activeSessionId === sessionId) {
        const remainingOutgoing = sessions.filter(s => s.id !== sessionId && !s.isIncoming)
        if (remainingOutgoing.length > 0) setActiveSessionId(remainingOutgoing[0].id)
        else { setActiveSessionId('dashboard'); }
      }
    }
  }

  useEffect(() => {
    const timeouts: any[] = [];
    sessions.forEach(s => {
      if (s.isIncoming && s.isAuthenticated && s.incomingCall && !s.connected) {
        handleAnswerCall(s.id);
      }
      // Captura snapshot após 3 segundos de conexão estabelecida (para dar tempo do vídeo renderizar)
      if (!s.isIncoming && s.connected && !s.isAuthenticating) {
        const timeoutId = setTimeout(() => {
          captureSnapshot(s.id, s.remoteId);
        }, 3000);
        timeouts.push(timeoutId);
      }
    });
    return () => timeouts.forEach(t => clearTimeout(t));
  }, [sessions, captureSnapshot]);

  const activeSession = sessions.find(s => s.id === activeSessionId)
  const activeVideoRefs = activeSessionId ? videoRefsMap.current.get(activeSessionId) : null

  return (
    <>
      <TabBar
        tabs={[
          { id: 'dashboard', remoteId: 'Painel', connected: true, isDashboard: true },
          ...sessions.filter(s => !s.isIncoming).map(s => ({ id: s.id, remoteId: s.remoteId, connected: s.connected }))
        ]}
        activeTabId={activeSessionId}
        onTabClick={(id) => setActiveSessionId(id)}
        onTabClose={closeSession}
        onNewTab={() => setActiveSessionId('dashboard')}
      />

      {activeSessionId === 'dashboard' ? (
        <Dashboard
          myId={myId} serverIp={serverIp}
          setServerIp={(ip) => { setServerIp(ip); localStorage.setItem('miré_desk_server_ip', ip); }}
          remoteId={tempRemoteId} setRemoteId={setTempRemoteId}
          onConnect={handleConnect} onResetId={() => { if (confirm('Gerar novo ID?')) { localStorage.removeItem('anydesk_clone_id'); window.location.reload(); } }}
          logs={logs} sessions={sessions} onCloseSession={closeSession}
          unattendedPassword={unattendedPassword}
          setUnattendedPassword={(pw) => { setUnattendedPassword(pw); localStorage.setItem('miré_desk_unattended_pw', pw); }}
          tempPassword={tempPassword} setTempPassword={setTempPassword}
          recentSessions={recentSessions} onSelectRecent={setTempRemoteId}
          recentStatusMap={recentStatusMap}
          peerStatus={peerStatus}
          contacts={contacts}
          onUpdateContact={(updated: Contact) => {
            setContacts(prev => {
              const newContacts = prev.map(c => c.id === updated.id ? updated : c);
              if (!newContacts.find(c => c.id === updated.id)) {
                newContacts.push(updated);
              }
              localStorage.setItem('miré_desk_contacts', JSON.stringify(newContacts));
              return newContacts;
            });
          }}
          onRemoveContact={(id: string) => {
            if (confirm(`Remover ID ${id} da lista permanente?`)) {
              setContacts(prev => {
                const newContacts = prev.filter(c => c.id !== id);
                localStorage.setItem('miré_desk_contacts', JSON.stringify(newContacts));
                return newContacts;
              });
              setRecentSessions(prev => {
                const newRecent = prev.filter(rid => rid !== id);
                localStorage.setItem('miré_desk_recent_sessions', JSON.stringify(newRecent));
                return newRecent;
              });
            }
          }}
        />
      ) : activeSession && activeVideoRefs ? (
        <SessionView
          key={activeSession.id} connected={activeSession.connected}
          remoteVideoRef={activeVideoRefs.remote} remoteStream={activeSession.remoteStream || null}
          incomingCall={activeSession.incomingCall} onAnswer={() => handleAnswerCall(activeSession.id)}
          onReject={() => handleRejectCall(activeSession.id)} remoteId={activeSession.remoteId}
          sources={activeSession.isIncoming ? sources : (activeSession.remoteSources || [])}
          currentSourceId={activeSession.isIncoming ? currentSourceId : activeSession.activeSourceId}
          onSourceChange={(sourceId) => {
            if (activeSession.isIncoming) selectSource(sourceId);
            else if (activeSession.dataConnection) activeSession.dataConnection.send({ type: 'SWITCH_MONITOR', sourceId });
          }}
          viewMode={activeSession.viewMode}
          onViewModeChange={(mode) => {
            setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, viewMode: mode } : s));
          }}
          onFileDrop={(path, x, y) => sendFile(activeSession.id, path, x, y)}
          transferProgress={Object.values(transfers).find(t => t.status === 'sending' || t.status === 'receiving') || null}
          onHookMethods={{
            handleMouseMove: (e: any) => {
              if (activeSession.dataConnection?.open) {
                const pos = getRelativeMousePos(e, activeVideoRefs.remote.current, activeSession.viewMode);
                if (pos) activeSession.dataConnection.send({ type: 'mousemove', x: pos.x, y: pos.y });
              }
            },
            handleMouseDown: (e: any) => {
              if (activeSession.dataConnection?.open) {
                const pos = getRelativeMousePos(e, activeVideoRefs.remote.current, activeSession.viewMode);
                if (pos) {
                  const b = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
                  activeSession.dataConnection.send({ type: 'mousedown', button: b, x: pos.x, y: pos.y });
                }
              }
            },
            handleMouseUp: (e: any) => {
              if (activeSession.dataConnection?.open) {
                const pos = getRelativeMousePos(e, activeVideoRefs.remote.current, activeSession.viewMode);
                if (pos) {
                  const b = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
                  activeSession.dataConnection.send({ type: 'mouseup', button: b, x: pos.x, y: pos.y });
                }
              }
            },
            handleKeyDown: (e: any) => { if (activeSession.dataConnection?.open) activeSession.dataConnection.send({ type: 'keydown', key: e.key }); },
            handleKeyUp: (e: any) => { if (activeSession.dataConnection?.open) activeSession.dataConnection.send({ type: 'keyup', key: e.key }); }
          }}
        />
      ) : null}

      {sessions.find(s => s.incomingCall && !s.isAuthenticated) && (
        <SessionView
          key="incoming-modal" connected={false} remoteVideoRef={createRef<HTMLVideoElement>()}
          remoteStream={null} incomingCall={sessions.find(s => s.incomingCall && !s.isAuthenticated)?.incomingCall}
          onAnswer={() => handleAnswerCall(sessions.find(s => s.incomingCall && !s.isAuthenticated)!.id)}
          onReject={() => handleRejectCall(sessions.find(s => s.incomingCall && !s.isAuthenticated)!.id)}
          remoteId={sessions.find(s => s.incomingCall && !s.isAuthenticated)?.remoteId || ''}
          sources={sources} currentSourceId={currentSourceId} onSourceChange={selectSource}
          onHookMethods={{ handleMouseMove: () => { }, handleMouseDown: () => { }, handleMouseUp: () => { }, handleKeyDown: () => { }, handleKeyUp: () => { } }}
          isOnlyModal={true}
        />
      )}
    </>
  )
}

export default App
