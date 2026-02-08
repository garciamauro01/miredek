import React, { useState, useEffect, useRef } from 'react';
import { Shield, X, Loader2, Key, AlertCircle } from 'lucide-react';
import '../styles/ConnectionModal.css';

interface ConnectionModalProps {
    remoteId: string;
    onCancel: () => void;
    onConnectWithPassword: (password: string, remember: boolean) => void;
    isConnecting?: boolean;
    initialPassword?: string;
    error?: string;
}

export function ConnectionModal({ remoteId, onCancel, onConnectWithPassword, isConnecting = false, initialPassword = '', error }: ConnectionModalProps) {
    const [password, setPassword] = useState(initialPassword || '');
    const [remember, setRemember] = useState(!!initialPassword);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialPassword !== undefined) {
            setPassword(initialPassword || '');
            setRemember(!!initialPassword);
        }
    }, [initialPassword]);

    // Auto-focus on error or mount
    useEffect(() => {
        if (!isConnecting && inputRef.current) {
            inputRef.current.focus();
            if (error) {
                inputRef.current.select(); // Select text on error for easy correction
            }
        }
    }, [isConnecting, error]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = password ? password.trim() : '';
        if (trimmed && !isConnecting) {
            onConnectWithPassword(trimmed, remember);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-container" style={{ pointerEvents: isConnecting ? 'none' : 'auto' }}>
                {/* Header */}
                <div className="modal-header">
                    <div className="modal-header-title">
                        <Shield size={20} color="#e03226" />
                        <span>Solicitação de Conexão</span>
                    </div>
                    <button onClick={onCancel} className="close-btn" style={{ pointerEvents: 'auto' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="modal-content">
                    {/* Status section only shown when waiting for host or initial connect, hidden on password error to focus UI */}
                    {!error && !password && (
                        <div className="status-section">
                            <div className="spinner-container">
                                <Loader2 size={24} color="#e03226" className="animate-spin" />
                            </div>
                            <h3 className="status-title">Conectando a {remoteId}</h3>
                            <p className="status-desc">
                                Aguardando o usuário remoto aceitar sua solicitação...
                            </p>
                        </div>
                    )}

                    <div className="form-box" style={{ marginTop: error || password ? '0' : '20px' }}>
                        <form onSubmit={handleSubmit}>
                            <label className="label-text">
                                {error ? 'AUTENTICAÇÃO FALHOU' : 'INSIRA A SENHA DE ACESSO'}
                            </label>

                            <div className={`password-wrapper ${error ? 'has-error' : ''}`}>
                                <Key size={16} color={error ? "#ef4444" : "#9ca3af"} className="password-icon" />
                                <input
                                    ref={inputRef}
                                    type="password"
                                    placeholder={isConnecting ? "Autenticando..." : "Senha de acesso..."}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isConnecting}
                                    className="password-field"
                                    style={{
                                        backgroundColor: isConnecting ? '#f9fafb' : '#fff',
                                        opacity: isConnecting ? 0.7 : 1,
                                        borderColor: error ? '#ef4444' : undefined
                                    }}
                                />
                            </div>

                            {error && (
                                <div className="error-message">
                                    <AlertCircle size={14} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="checkbox-wrapper" onClick={() => !isConnecting && setRemember(!remember)}>
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    readOnly
                                    style={{ cursor: 'pointer' }}
                                />
                                <span className="checkbox-label">Lembrar senha neste computador</span>
                            </div>

                            <button
                                type="submit"
                                disabled={!password?.trim() || isConnecting}
                                className="submit-btn"
                            >
                                {isConnecting ? 'Autenticando...' : 'Conectar com Senha'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <button onClick={onCancel} className="cancel-btn">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}
