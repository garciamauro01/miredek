import React, { useState, useEffect } from 'react';
import { Shield, X, Loader2, Key } from 'lucide-react';
import '../styles/ConnectionModal.css';

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

    useEffect(() => {
        setPassword(initialPassword);
        setRemember(!!initialPassword);
    }, [initialPassword]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password.trim()) {
            onConnectWithPassword(password, remember);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-container">
                {/* Header */}
                <div className="modal-header">
                    <div className="modal-header-title">
                        <Shield size={20} color="#e03226" />
                        <span>Solicitação de Conexão</span>
                    </div>
                    <button onClick={onCancel} className="close-btn">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="modal-content">
                    <div className="status-section">
                        <div className="spinner-container">
                            <Loader2 size={24} color="#e03226" className="animate-spin" />
                        </div>
                        <h3 className="status-title">Conectando a {remoteId}</h3>
                        <p className="status-desc">
                            Aguardando o usuário remoto aceitar sua solicitação...
                        </p>
                    </div>

                    <div className="form-box">
                        <form onSubmit={handleSubmit}>
                            <label className="label-text">
                                OU INSIRA A SENHA DE ACESSO
                            </label>
                            <div className="password-wrapper">
                                <Key size={16} color="#9ca3af" className="password-icon" />
                                <input
                                    autoFocus
                                    type="password"
                                    placeholder={isConnecting ? "Conectando..." : "Senha de acesso..."}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isConnecting}
                                    className="password-field"
                                    style={{ backgroundColor: isConnecting ? '#f9fafb' : '#fff', opacity: isConnecting ? 0.7 : 1 }}
                                />
                            </div>

                            <div className="checkbox-wrapper" onClick={() => setRemember(!remember)}>
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={(e) => setRemember(e.target.checked)}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ cursor: 'pointer' }}
                                />
                                <span className="checkbox-label">Lembrar senha neste computador</span>
                            </div>

                            <button
                                type="submit"
                                disabled={!password.trim() || isConnecting}
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
