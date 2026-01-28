import { useEffect } from 'react';
// Imports removidos (agora na TitleBar)

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
    isOnlyModal?: boolean;
    onFileDrop?: (path: string, x?: number, y?: number) => void;
    transferProgress?: { name: string; progress: number; status: string } | null;
    viewMode?: 'fit' | 'original' | 'stretch';
}

export function SessionView({
    connected, remoteVideoRef, remoteStream, incomingCall,
    onAnswer, onReject, onHookMethods, remoteId,
    isOnlyModal = false, onFileDrop, transferProgress,
    viewMode = 'fit'
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

                {/* Toolbar removida - movida para CustomTitleBar */}

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
                            cursor: 'default'
                        }}
                        onMouseMove={onHookMethods.handleMouseMove}
                        onMouseDown={(e) => {
                            console.log('[SessionView] MouseDown captured at', e.clientX, e.clientY);
                            onHookMethods.handleMouseDown(e);
                        }}
                        onMouseUp={(e) => {
                            console.log('[SessionView] MouseUp captured at', e.clientX, e.clientY);
                            onHookMethods.handleMouseUp(e);
                        }}
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
                                    const videoX = e.clientX - rect.left;
                                    const videoY = e.clientY - rect.top;
                                    const video = remoteVideoRef.current!;

                                    const cw = video.clientWidth;
                                    const ch = video.clientHeight;
                                    const vw = video.videoWidth;
                                    const vh = video.videoHeight;

                                    let finalX = 0;
                                    let finalY = 0;

                                    if (viewMode === 'stretch') {
                                        finalX = videoX / cw;
                                        finalY = videoY / ch;
                                    } else if (viewMode === 'original') {
                                        finalX = videoX / cw;
                                        finalY = videoY / ch;
                                    } else {
                                        // Modo Fit (contain)
                                        const videoRatio = vw / vh;
                                        const elementRatio = cw / ch;

                                        let actualWidth, actualHeight, offsetX, offsetY;
                                        if (elementRatio > videoRatio) {
                                            actualHeight = ch;
                                            actualWidth = actualHeight * videoRatio;
                                            offsetX = (cw - actualWidth) / 2;
                                            offsetY = 0;
                                        } else {
                                            actualWidth = cw;
                                            actualHeight = actualWidth / videoRatio;
                                            offsetX = 0;
                                            offsetY = (ch - actualHeight) / 2;
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
