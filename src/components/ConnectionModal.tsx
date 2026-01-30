import React, { useState, useEffect } from 'react';
import { Shield, X, Loader2, Key } from 'lucide-react';

interface ConnectionModalProps {
    remoteId: string;
    onCancel: () => void;
    onConnectWithPassword: (password: string, remember: boolean) => void;
    isConnecting?: boolean;
    initialPassword?: string;
}

export function ConnectionModal({ remoteId, onCancel, onConnectWithPassword, isConnecting = false, initialPassword = '' }: ConnectionModalProps) {
    const [password, setPassword] = useState(initialPassword);
    const [remember, setRemember] = useState(!!initialPassword);

    // Sincroniza o estado local quando initialPassword mudar
    useEffect(() => {
        setPassword(initialPassword);
        setRemember(!!initialPassword);
    }, [initialPassword]);

    console.log(`[ConnectionModal] Renderizando para ${remoteId}, isConnecting:`, isConnecting, 'initialPassword:', initialPassword, 'password state:', password);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password.trim()) {
            onConnectWithPassword(password, remember);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                width: '400px',
                backgroundColor: '#fff',
                borderRadius: '12px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden',
                animation: 'modalEnter 0.3s ease-out'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8f9fa'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Shield size={20} color="#e03226" />
                        <span style={{ fontWeight: 600, color: '#333' }}>Solicitação de Conexão</span>
                    </div>
                    <button
                        onClick={onCancel}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: '#fee2e2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px'
                        }}>
                            <Loader2 size={24} color="#e03226" className="animate-spin" />
                        </div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#111' }}>Conectando a {remoteId}</h3>
                        <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                            Aguardando o usuário remoto aceitar sua solicitação...
                        </p>
                    </div>

                    <div style={{
                        padding: '16px',
                        background: '#f3f4f6',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                    }}>
                        <form onSubmit={handleSubmit}>
                            <label style={{
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: '8px'
                            }}>
                                OU INSIRA A SENHA DE ACESSO
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Key size={16} color="#9ca3af" style={{
                                    position: 'absolute',
                                    left: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)'
                                }} />
                                <input
                                    autoFocus
                                    type="password"
                                    placeholder={isConnecting ? "Conectando..." : "Senha de acesso..."}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isConnecting}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px 10px 36px',
                                        borderRadius: '6px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '14px',
                                        boxSizing: 'border-box',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                        backgroundColor: isConnecting ? '#f9fafb' : '#fff',
                                        opacity: isConnecting ? 0.7 : 1
                                    }}
                                    className="focus:border-red-500"
                                />
                            </div>

                            <div style={{
                                marginTop: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                userSelect: 'none'
                            }} onClick={() => setRemember(!remember)}>
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={(e) => setRemember(e.target.checked)}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '13px', color: '#4b5563' }}>Lembrar senha neste computador</span>
                            </div>

                            <button
                                type="submit"
                                disabled={!password.trim() || isConnecting}
                                style={{
                                    width: '100%',
                                    marginTop: '16px',
                                    padding: '10px',
                                    backgroundColor: (password.trim() && !isConnecting) ? '#e03226' : '#9ca3af',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    cursor: (password.trim() && !isConnecting) ? 'pointer' : 'not-allowed',
                                    transition: 'background-color 0.2s'
                                }}
                            >
                                {isConnecting ? 'Autenticando...' : 'Conectar com Senha'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    background: '#f8f9fa',
                    borderTop: '1px solid #eee',
                    textAlign: 'right'
                }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '8px 16px',
                            background: 'white',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            color: '#374151',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: 'pointer'
                        }}
                    >
                        Cancelar
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes modalEnter {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
