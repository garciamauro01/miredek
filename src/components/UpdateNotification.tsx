import { Download, X } from 'lucide-react';

interface UpdateNotificationProps {
    info: {
        version: string;
        critical: boolean;
        downloadUrl: string;
        releaseNotes: string;
    } | null;
    onClose: () => void;
    onDownload: (url: string) => void;
}

export function UpdateNotification({ info, onClose, onDownload }: UpdateNotificationProps) {
    if (!info) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '320px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            zIndex: 9999,
            overflow: 'hidden',
            border: '1px solid #e0e0e0',
            animation: 'slideUp 0.3s ease-out'
        }}>
            <style>
                {`
                    @keyframes slideUp {
                        from { transform: translateY(100px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                `}
            </style>

            <div style={{
                padding: '16px',
                background: info.critical ? 'linear-gradient(135deg, #ff4d4d, #cc0000)' : 'linear-gradient(135deg, #4A90E2, #357ABD)',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Download size={20} />
                    <span style={{ fontWeight: 600 }}>Nova Versão: {info.version}</span>
                </div>
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}
                >
                    <X size={18} />
                </button>
            </div>

            <div style={{ padding: '16px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                    Uma nova atualização do Miré-Desk está disponível.
                </p>
                {info.releaseNotes && (
                    <div style={{
                        fontSize: '12px',
                        color: '#888',
                        backgroundColor: '#f9f9f9',
                        padding: '8px',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        maxHeight: '60px',
                        overflowY: 'auto'
                    }}>
                        {info.releaseNotes}
                    </div>
                )}
                <button
                    onClick={() => onDownload(info.downloadUrl)}
                    style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: info.critical ? '#cc0000' : '#357ABD',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                >
                    {info.critical ? 'Atualizar Agora (Crítico)' : 'Baixar e Instalar'}
                </button>
            </div>
        </div>
    );
}
