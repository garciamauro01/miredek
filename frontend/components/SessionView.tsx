import { useEffect } from 'react';
import '../styles/SessionView.css';

interface SessionViewProps {
    connected: boolean;
    remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
    remoteStream: MediaStream | null;
    incomingCall: any;
    onAnswer: () => void;
    onReject: () => void;
    onHookMethods: {
        handleMouseMove: (e: React.MouseEvent | React.TouchEvent) => void;
        handleMouseDown: (e: React.MouseEvent | React.TouchEvent) => void;
        handleMouseUp: (e: React.MouseEvent | React.TouchEvent) => void;
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
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, remoteVideoRef]);

    if (isOnlyModal) {
        return incomingCall ? (
            <div className="incoming-modal-overlay">
                <div className="incoming-card">
                    <h2 className="incoming-title">Pedido de Conexão</h2>
                    <div style={{ fontSize: '16px', marginBottom: '20px' }}>
                        ID: <b>{incomingCall.peer}</b> deseja conectar.
                    </div>

                    <div className="incoming-buttons">
                        <button onClick={onAnswer} className="btn-accept">ACEITAR</button>
                        <button onClick={onReject} className="btn-reject">REJEITAR</button>
                    </div>
                    <div style={{ marginTop: '20px', fontSize: '12px', color: '#777' }}>
                        Isso permitirá que vejam sua tela e usem o mouse.
                    </div>
                </div>
            </div>
        ) : null;
    }

    // Dynamic style based on viewMode
    const videoStyle: React.CSSProperties = {
        width: viewMode === 'original' ? 'auto' : '100%',
        height: viewMode === 'original' ? 'auto' : '100%',
        objectFit: viewMode === 'fit' ? 'contain' : (viewMode === 'stretch' ? 'fill' : 'none'),
    };

    return (
        <div className="session-view-container">
            <div className={`video-container ${viewMode === 'original' ? 'original' : ''}`}>
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    controls={false}
                    className="remote-video"
                    style={videoStyle}
                    onMouseMove={onHookMethods.handleMouseMove}
                    onMouseDown={onHookMethods.handleMouseDown}
                    onMouseUp={onHookMethods.handleMouseUp}
                    tabIndex={0}
                    onKeyDown={onHookMethods.handleKeyDown}
                    onKeyUp={onHookMethods.handleKeyUp}
                    onTouchStart={(e) => { if (e.cancelable) e.preventDefault(); onHookMethods.handleMouseDown(e); }}
                    onTouchEnd={(e) => { if (e.cancelable) e.preventDefault(); onHookMethods.handleMouseUp(e); }}
                    onTouchMove={(e) => { if (e.cancelable) e.preventDefault(); onHookMethods.handleMouseMove(e); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const files = (e.nativeEvent as any).dataTransfer.files;
                        if (files && files.length > 0 && files[0].path) {
                            const rect = remoteVideoRef.current?.getBoundingClientRect();
                            if (rect) {
                                // Same logic as before for calculating position relative to video
                                const videoX = e.clientX - rect.left;
                                const videoY = e.clientY - rect.top;
                                const video = remoteVideoRef.current!;
                                const cw = video.clientWidth;
                                const ch = video.clientHeight;
                                const vw = video.videoWidth;
                                const vh = video.videoHeight;
                                let finalX = 0, finalY = 0;

                                if (viewMode === 'stretch' || viewMode === 'original') {
                                    finalX = videoX / cw; finalY = videoY / ch;
                                } else {
                                    const videoRatio = vw / vh;
                                    const elementRatio = cw / ch;
                                    let actualWidth, actualHeight, offsetX, offsetY;
                                    if (elementRatio > videoRatio) {
                                        actualHeight = ch; actualWidth = actualHeight * videoRatio;
                                        offsetX = (cw - actualWidth) / 2; offsetY = 0;
                                    } else {
                                        actualWidth = cw; actualHeight = actualWidth / videoRatio;
                                        offsetX = 0; offsetY = (ch - actualHeight) / 2;
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

                {transferProgress && (
                    <div className="transfer-overlay">
                        <div className="transfer-status">
                            {transferProgress.status === 'sending' ? 'Enviando...' : 'Recebendo...'}
                        </div>
                        <div className="transfer-name">{transferProgress.name}</div>
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${transferProgress.progress}%` }}></div>
                        </div>
                        <div className="progress-percent">{transferProgress.progress}%</div>
                    </div>
                )}

                {!connected && !incomingCall && (
                    <div className="waiting-overlay">
                        <h3>Aguardando o usuário aceitar a conexão...</h3>
                        <p className="waiting-id">ID: {remoteId}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
