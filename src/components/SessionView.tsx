import { useEffect } from 'react';
import { Settings, MessageSquare, Keyboard } from 'lucide-react';

interface SessionViewProps {
    connected: boolean;
    remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
    remoteStream: MediaStream | null;
    incomingCall: any;
    onAnswer: () => void;
    onReject: () => void;
    onHookMethods: {
        handleMouseMove: (e: React.MouseEvent) => void;
        handleMouseDown: (e: React.MouseEvent) => void;
        handleMouseUp: (e: React.MouseEvent) => void;
        handleKeyDown: (e: React.KeyboardEvent) => void;
        handleKeyUp: (e: React.KeyboardEvent) => void;
    };
    remoteId: string;
    sources?: any[];
    currentSourceId?: string;
    onSourceChange?: (id: string) => void;
    isOnlyModal?: boolean;
    onFileDrop?: (path: string, x?: number, y?: number) => void;
    transferProgress?: { name: string; progress: number; status: string } | null;
    viewMode?: 'fit' | 'original' | 'stretch';
    onViewModeChange?: (mode: 'fit' | 'original' | 'stretch') => void;
}

export function SessionView({
    connected, remoteVideoRef, remoteStream, incomingCall,
    onAnswer, onReject, onHookMethods, remoteId,
    sources = [], currentSourceId, onSourceChange,
    isOnlyModal = false, onFileDrop, transferProgress,
    viewMode = 'fit', onViewModeChange
}: SessionViewProps) {

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            console.log('[SessionView] Atribuindo remoteStream ao elemento video');
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, remoteVideoRef]);


    console.log(`[SessionView] Renderizado (${isOnlyModal ? 'MODAL' : 'FULL'}). ID: ${remoteId}, Conectado: ${connected}, Tem Chamada: ${!!incomingCall}`);

    if (isOnlyModal) {
        return incomingCall ? (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.6)', zIndex: 100001,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <div style={{
                    background: '#fff', padding: '30px', borderRadius: '8px',
                    textAlign: 'center', border: '1px solid #ddd',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)', width: '400px',
                    color: '#333'
                }}>
                    <h2 style={{ margin: '0 0 10px 0', color: '#e03226' }}>Pedido de Conexão</h2>
                    <div style={{ fontSize: '16px', marginBottom: '20px' }}>
                        ID: <b>{incomingCall.peer}</b> deseja conectar.
                    </div>

                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                        <button
                            id="btn-accept"
                            onClick={() => {
                                console.log('[SessionView] Standalone Modal - ACEITAR');
                                onAnswer();
                            }}
                            style={{
                                background: '#34a853', color: 'white', border: 'none',
                                padding: '12px 30px', borderRadius: '4px', cursor: 'pointer',
                                fontWeight: 'bold', fontSize: '14px'
                            }}
                        >
                            ACEITAR
                        </button>
                        <button
                            id="btn-reject"
                            onClick={() => {
                                console.log('[SessionView] Standalone Modal - REJEITAR');
                                onReject();
                            }}
                            style={{
                                background: '#ea4335', color: 'white', border: 'none',
                                padding: '12px 30px', borderRadius: '4px', cursor: 'pointer',
                                fontWeight: 'bold', fontSize: '14px'
                            }}
                        >
                            REJEITAR
                        </button>
                    </div>
                    <div style={{ marginTop: '20px', fontSize: '12px', color: '#777' }}>
                        Isso permitirá que vejam sua tela e usem o mouse.
                    </div>
                </div>
            </div>
        ) : null;
    }

    return (
        <>
            <div style={{ position: 'fixed', top: '40px', left: 0, width: '100vw', height: 'calc(100vh - 40px)', background: '#000', display: 'flex', flexDirection: 'column' }}>

                {/* AnyDesk-like Toolbar - Agora dentro do SessionView mas abaixo das abas */}
                <div style={{
                    height: '35px', background: '#2d2d2d', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 10px', fontSize: '12px',
                    borderBottom: '1px solid #444'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#444', padding: '2px 8px', borderRadius: '4px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: connected ? '#4CAF50' : '#FF9800' }}></span>
                            <span>{remoteId || 'Desconhecido'}</span>
                        </div>

                        <div className="toolbar-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {/* Botões de Monitores */}
                            {sources && sources.length > 1 && (
                                <div style={{
                                    display: 'flex', gap: '4px', background: '#444',
                                    padding: '2px 5px', borderRadius: '4px', marginRight: '10px',
                                    border: '1px solid #555'
                                }}>
                                    {sources.map((source, index) => (
                                        <button
                                            key={source.id}
                                            onClick={() => onSourceChange?.(source.id)}
                                            style={{
                                                width: '24px', height: '20px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '10px', fontWeight: 'bold', border: 'none',
                                                borderRadius: '2px', cursor: 'pointer',
                                                background: currentSourceId === source.id ? '#e03226' : '#555',
                                                color: '#fff'
                                            }}
                                            title={source.name}
                                        >
                                            M{index + 1}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <button title="Chat" style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer' }}><MessageSquare size={16} /></button>
                            <button title="Teclado" style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer' }}><Keyboard size={16} /></button>

                            {/* Seletor de Modo de Exibição */}
                            <div style={{ display: 'flex', gap: '2px', background: '#444', padding: '2px', borderRadius: '4px', border: '1px solid #555' }}>
                                <button
                                    onClick={() => onViewModeChange?.('fit')}
                                    style={{
                                        padding: '2px 6px', fontSize: '10px', border: 'none', borderRadius: '2px', cursor: 'pointer',
                                        background: viewMode === 'fit' ? '#e03226' : 'none', color: '#fff'
                                    }} title="Ajustar à Tela">Ajustar</button>
                                <button
                                    onClick={() => onViewModeChange?.('original')}
                                    style={{
                                        padding: '2px 6px', fontSize: '10px', border: 'none', borderRadius: '2px', cursor: 'pointer',
                                        background: viewMode === 'original' ? '#e03226' : 'none', color: '#fff'
                                    }} title="Tamanho Original (1:1)">1:1</button>
                                <button
                                    onClick={() => onViewModeChange?.('stretch')}
                                    style={{
                                        padding: '2px 6px', fontSize: '10px', border: 'none', borderRadius: '2px', cursor: 'pointer',
                                        background: viewMode === 'stretch' ? '#e03226' : 'none', color: '#fff'
                                    }} title="Estender">Estender</button>
                            </div>

                            <button title="Configurações" style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer' }}><Settings size={16} /></button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            title="Encerrar Sessão"
                            onClick={() => window.location.reload()}
                            style={{
                                background: 'rgba(211, 47, 47, 0.1)',
                                border: '1px solid #d32f2f',
                                color: '#ff5252',
                                padding: '3px 10px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            ENCERRAR
                        </button>
                    </div>
                </div>

                {/* Main Area */}
                <div style={{ flex: 1, position: 'relative', overflow: viewMode === 'original' ? 'auto' : 'hidden', display: 'flex', alignItems: viewMode === 'original' ? 'flex-start' : 'center', justifyContent: viewMode === 'original' ? 'flex-start' : 'center' }}>

                    {/* Remote Video */}
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        controls={false}
                        style={{
                            width: viewMode === 'original' ? 'auto' : '100%',
                            height: viewMode === 'original' ? 'auto' : '100%',
                            objectFit: viewMode === 'fit' ? 'contain' : (viewMode === 'stretch' ? 'fill' : 'none'),
                            background: '#111',
                            cursor: 'crosshair'
                        }}
                        onMouseMove={onHookMethods.handleMouseMove}
                        onMouseDown={onHookMethods.handleMouseDown}
                        onMouseUp={onHookMethods.handleMouseUp}
                        tabIndex={0}
                        onKeyDown={onHookMethods.handleKeyDown}
                        onKeyUp={onHookMethods.handleKeyUp}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const files = (e.nativeEvent as any).dataTransfer.files;
                            if (files && files.length > 0 && files[0].path) {
                                // Calculamos a posição relativa no momento do drop
                                const rect = remoteVideoRef.current?.getBoundingClientRect();
                                if (rect) {
                                    const video = remoteVideoRef.current!;
                                    const videoX = e.clientX - rect.left;
                                    const videoY = e.clientY - rect.top;

                                    let finalX = 0;
                                    let finalY = 0;

                                    if (viewMode === 'stretch') {
                                        finalX = videoX / video.clientWidth;
                                        finalY = videoY / video.clientHeight;
                                    } else if (viewMode === 'original') {
                                        finalX = videoX / video.videoWidth;
                                        finalY = videoY / video.videoHeight;
                                    } else {
                                        // Modo Fit (contain)
                                        const videoRatio = video.videoWidth / video.videoHeight;
                                        const elementRatio = video.clientWidth / video.clientHeight;

                                        let actualWidth, actualHeight, offsetX, offsetY;
                                        if (elementRatio > videoRatio) {
                                            actualHeight = video.clientHeight;
                                            actualWidth = actualHeight * videoRatio;
                                            offsetX = (video.clientWidth - actualWidth) / 2;
                                            offsetY = 0;
                                        } else {
                                            actualWidth = video.clientWidth;
                                            actualHeight = actualWidth / videoRatio;
                                            offsetX = 0;
                                            offsetY = (video.clientHeight - actualHeight) / 2;
                                        }

                                        finalX = (videoX - offsetX) / actualWidth;
                                        finalY = (videoY - offsetY) / actualHeight;
                                    }

                                    if (finalX >= 0 && finalX <= 1 && finalY >= 0 && finalY <= 1) {
                                        onFileDrop?.(files[0].path, finalX, finalY);
                                    } else {
                                        onFileDrop?.(files[0].path);
                                    }
                                } else {
                                    onFileDrop?.(files[0].path);
                                }
                            }
                        }}
                    ></video>

                    {/* Transfer Progress Overlay */}
                    {transferProgress && (
                        <div style={{
                            position: 'absolute', bottom: '20px', right: '20px',
                            background: 'rgba(45,45,45,0.9)', padding: '15px',
                            borderRadius: '8px', border: '1px solid #555',
                            width: '250px', color: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                            zIndex: 100
                        }}>
                            <div style={{ fontSize: '11px', marginBottom: '8px', opacity: 0.8, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {transferProgress.status === 'sending' ? 'Enviando...' : 'Recebendo...'}
                            </div>
                            <div style={{ fontSize: '13px', marginBottom: '10px', fontWeight: 'bold' }}>{transferProgress.name}</div>
                            <div style={{ height: '6px', background: '#444', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${transferProgress.progress}%`, background: '#34a853', transition: 'width 0.3s ease' }}></div>
                            </div>
                            <div style={{ fontSize: '10px', marginTop: '6px', textAlign: 'right', opacity: 0.7 }}>{transferProgress.progress}%</div>
                        </div>
                    )}

                    {/* Message Overlay if Waiting */}
                    {!connected && !incomingCall && (
                        <div style={{ position: 'absolute', color: '#fff', textAlign: 'center' }}>
                            <h3>Aguardando conexão...</h3>
                            <p style={{ color: '#aaa', fontSize: '12px' }}>ID: {remoteId}</p>
                        </div>
                    )}


                </div>
            </div>

            {/* Incoming Call Modal Overlay - Root level to ensure clickability */}
            {incomingCall && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', zIndex: 100000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: '#fff', padding: '30px', borderRadius: '8px',
                        textAlign: 'center', border: '1px solid #ddd',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)', width: '400px',
                        color: '#333'
                    }}>
                        <h2 style={{ margin: '0 0 10px 0', color: '#e03226' }}>Pedido de Conexão</h2>
                        <div style={{ fontSize: '16px', marginBottom: '20px' }}>
                            ID: <b>{incomingCall.peer}</b> deseja conectar.
                        </div>

                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button
                                onClick={() => {
                                    console.log('[SessionView] Clique DETECTADO em ACEITAR');
                                    onAnswer();
                                }}
                                style={{
                                    background: '#34a853', color: 'white', border: 'none',
                                    padding: '12px 30px', borderRadius: '4px', cursor: 'pointer',
                                    fontWeight: 'bold', fontSize: '14px'
                                }}
                            >
                                ACEITAR
                            </button>
                            <button
                                onClick={() => {
                                    console.log('[SessionView] Clique DETECTADO em REJEITAR');
                                    onReject();
                                }}
                                style={{
                                    background: '#ea4335', color: 'white', border: 'none',
                                    padding: '12px 30px', borderRadius: '4px', cursor: 'pointer',
                                    fontWeight: 'bold', fontSize: '14px'
                                }}
                            >
                                REJEITAR
                            </button>
                        </div>
                        <div style={{ marginTop: '20px', fontSize: '12px', color: '#777' }}>
                            Isso permitirá que vejam sua tela e usem o mouse.
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
