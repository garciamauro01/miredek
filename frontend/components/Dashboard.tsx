import { useState, useEffect } from 'react';
import { Monitor, Settings, Search, Copy, RotateCw, ShieldCheck, Star, Bug, MoreVertical, History as HistoryIcon } from 'lucide-react';
import type { Contact } from '../types/Contact';
import '../styles/Dashboard.css';

interface DashboardProps {
    myId: string;
    serverIp: string;
    setServerIp: (ip: string) => void;
    remoteId: string;
    setRemoteId: (id: string) => void;
    onConnect: () => void;
    onResetId: () => void;
    logs: string[];
    sessions?: any[];
    onCloseSession?: (id: string) => void;
    unattendedPassword?: string;
    setUnattendedPassword?: (password: string) => void;
    sessionPassword?: string;
    onRegenerateSessionPassword?: () => void;
    recentSessions?: string[];
    onSelectRecent?: (id: string) => void;
    recentStatusMap?: { [id: string]: 'online' | 'offline' | 'checking' };
    peerStatus?: 'online' | 'offline' | 'connecting';
    contacts?: Contact[];
    onUpdateContact?: (contact: Contact) => void;
    onRemoveContact?: (id: string) => void;
}

export function Dashboard({
    myId,
    serverIp, setServerIp,
    remoteId, setRemoteId, onConnect,
    unattendedPassword, setUnattendedPassword,
    sessionPassword, onRegenerateSessionPassword,
    recentSessions = [], onSelectRecent,
    recentStatusMap = {},
    peerStatus = 'offline',
    contacts = [],
    onUpdateContact,
    onRemoveContact,
    sessions = [],
    onCloseSession
}: DashboardProps) {

    const [activeTab, setActiveTab] = useState<'recent' | 'favorites' | 'address' | 'transfers'>('recent');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [showMenuId, setShowMenuId] = useState<string | null>(null);
    const [appVersion, setAppVersion] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [tempServerIp, setTempServerIp] = useState(serverIp);
    const [iAmAdmin, setIAmAdmin] = useState(false);

    const [serviceStatus, setServiceStatus] = useState<'running' | 'stopped' | 'not-installed'>('not-installed');

    useEffect(() => {
        setTempServerIp(serverIp);
    }, [serverIp]);

    useEffect(() => {
        const init = async () => {
            if (window.electronAPI) {
                window.electronAPI.getAppVersion().then(setAppVersion);
                // @ts-ignore
                window.electronAPI.isAdmin?.().then(setIAmAdmin);

                const srvStatus = await window.electronAPI.getServiceStatus?.();
                if (srvStatus) setServiceStatus(srvStatus);
            }
        };
        init();

        // Polling status for service
        const interval = setInterval(async () => {
            if (window.electronAPI && window.electronAPI.getServiceStatus) {
                const srvStatus = await window.electronAPI.getServiceStatus();
                setServiceStatus(srvStatus);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, []);



    return (
        <div className="dashboard-container">
            {/* --- SIDEBAR --- */}
            <div className="sidebar">
                <div className="sidebar-content">
                    <h2 className="sidebar-title">Seu Computador</h2>
                    <p className="sidebar-desc">
                        Seu computador pode ser acessado com este ID e senha.
                    </p>

                    {/* CONNECTION INDICATOR BANNER */}
                    {sessions && sessions.filter(s => s.isIncoming && s.connected).length > 0 && (
                        <div style={{
                            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
                            color: 'white',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '0 4px 12px rgba(255, 107, 107, 0.3)',
                            animation: 'pulse 2s ease-in-out infinite'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: '#fff',
                                    animation: 'blink 1s ease-in-out infinite'
                                }} />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                        🔴 Conexão Remota Ativa
                                    </div>
                                    <div style={{ fontSize: '12px', opacity: 0.9 }}>
                                        {sessions.filter(s => s.isIncoming && s.connected).map(s => s.remoteId).join(', ')} está controlando esta máquina
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    const incomingSessions = sessions.filter(s => s.isIncoming && s.connected);
                                    incomingSessions.forEach(s => onCloseSession?.(s.id));
                                }}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    border: '1px solid rgba(255, 255, 255, 0.3)',
                                    color: 'white',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                            >
                                Desconectar
                            </button>
                        </div>
                    )}

                    {/* ID Card */}
                    <div className="id-card">
                        <div className="id-label">Seu ID</div>
                        <div className="id-display">
                            <span className="id-text">
                                {myId || '--- --- ---'}
                            </span>
                            <button onClick={() => navigator.clipboard.writeText(myId)} className="icon-btn">
                                <Copy size={18} />
                            </button>
                        </div>
                        <button className="invite-btn" onClick={() => {/* Lógica de convite */ }}>
                            Convidar
                        </button>
                    </div>

                    {/* Password Section */}
                    <div className="password-section">
                        <h3 className="section-title">Senhas de Acesso</h3>

                        {/* Senha Temporária */}
                        <div style={{ marginBottom: '15px' }}>
                            <label className="field-label">Senha Temporária (Sessão)</label>
                            <div className="password-display">
                                <input
                                    type="text"
                                    readOnly
                                    value={sessionPassword || '...'}
                                    className="password-input"
                                />
                                <button title="Gerar nova senha" onClick={onRegenerateSessionPassword} className="icon-btn">
                                    <RotateCw size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Senha Fixa */}
                        <div>
                            <label className="field-label">Senha Fixa (Não Supervisionado)</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="password"
                                    value={unattendedPassword}
                                    onChange={(e) => setUnattendedPassword?.(e.target.value)}
                                    placeholder="Definir senha fixa..."
                                    className="unattended-input"
                                />
                                <ShieldCheck size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#10b981' }} />
                            </div>
                        </div>
                    </div>

                    {/* Service Status Monitoring (Managed by Installer) */}
                    <div className="password-section" style={{ marginTop: '20px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '15px' }}>
                        <h3 className="section-title">Serviço de Acesso</h3>
                        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                            O acesso remoto via boot é gerenciado automaticamente pelo instalador.
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: serviceStatus === 'running' ? '#10b981' : (serviceStatus === 'stopped' ? '#f59e0b' : '#9ca3af')
                            }}></div>
                            <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                                {serviceStatus === 'running' ? 'Serviço Ativo' : (serviceStatus === 'stopped' ? 'Serviço Parado' : 'Serviço não instalado')}
                            </span>
                        </div>
                    </div>

                    {/* App Settings Shortcut */}
                    <div className="settings-shortcut">
                        <div onClick={() => setShowSettings(true)} className="settings-btn">
                            <Settings size={16} />
                            <span>Configurações</span>
                        </div>
                    </div>
                </div>

                {/* Sidebar Footer */}
                <div className="sidebar-footer">
                    <img src="./splash.png" alt="Mire-Desk" className="splash-img" />
                    <div className="version-text">Miré-Desk v{appVersion}</div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: '#6b7280' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ShieldCheck size={12} color={iAmAdmin ? '#10b981' : '#9ca3af'} />
                            <span>{iAmAdmin ? 'Admin' : 'Usuário'}</span>
                        </div>
                        {!iAmAdmin && (
                            <button
                                onClick={() => window.electronAPI?.requestElevation?.()}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#3b82f6',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    textDecoration: 'underline'
                                }}
                                title="Reiniciar com privilégios de Admin"
                            >
                                Elevar
                            </button>
                        )}
                    </div>

                    <div onClick={() => window.electronAPI?.openDebugWindow?.()} className="debug-btn" title="Monitorar Comandos (Debug)">
                        <Bug size={12} />
                        <span>Debug</span>
                    </div>
                </div>
            </div>

            {/* --- MAIN AREA --- */}
            <div className="main-area">
                <div className="connection-header">
                    <h1 className="main-title">Controle um Computador Remoto</h1>

                    <div className="connection-controls">
                        <div style={{ flex: 1, position: 'relative' }}>
                            <input
                                type="text"
                                value={remoteId}
                                onChange={(e) => setRemoteId(e.target.value)}
                                placeholder="Insira o ID da mesa remota..."
                                className="remote-id-input"
                            />
                        </div>
                        <button onClick={onConnect} className="connect-btn">
                            Conectar
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="content-area">
                    <div className="tabs">
                        {[
                            { id: 'recent', label: 'Sessões Recentes' },
                            { id: 'favorites', label: 'Favoritos' },
                            { id: 'address', label: 'Lista de Endereços' },
                            { id: 'transfers', label: 'Transferências' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="search-bar">
                        <div className="search-container">
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                            <input
                                type="text"
                                placeholder="Pesquisar ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="grid-container">
                        {(() => {
                            if (activeTab === 'transfers') {
                                return (
                                    <div className="empty-state">
                                        <HistoryIcon size={48} style={{ color: '#ccc', marginBottom: '15px' }} />
                                        <div>Nenhuma transferência nos registros.</div>
                                    </div>
                                );
                            }

                            const list = activeTab === 'recent'
                                ? recentSessions.map(id => contacts.find(c => c.id === id) || { id, isFavorite: false } as Contact)
                                : activeTab === 'favorites'
                                    ? contacts.filter(c => c.isFavorite)
                                    : contacts;

                            const filtered = list.filter(c =>
                                c.id.includes(searchTerm) ||
                                (c.alias && c.alias.toLowerCase().includes(searchTerm.toLowerCase()))
                            );

                            if (filtered.length === 0) {
                                return (
                                    <div className="empty-state" style={{ border: 'none', background: 'transparent' }}>
                                        Nenhum computador encontrado.
                                    </div>
                                );
                            }

                            return filtered.map((contact) => (
                                <div
                                    key={contact.id}
                                    onDoubleClick={() => { setRemoteId(contact.id); setTimeout(onConnect, 50); }}
                                    onClick={() => onSelectRecent?.(contact.id)}
                                    className="contact-card"
                                >
                                    <div className="card-thumb">
                                        {contact.thumbnail ? (
                                            <img src={contact.thumbnail} className="card-img" />
                                        ) : (
                                            <div className="card-placeholder">
                                                <Monitor size={48} color="rgba(255,255,255,0.2)" />
                                            </div>
                                        )}
                                        <div className="status-dot" style={{
                                            background: recentStatusMap[contact.id] === 'online' ? '#10b981' : '#ef4444'
                                        }}></div>
                                    </div>

                                    <div className="card-info">
                                        <div style={{ overflow: 'hidden' }}>
                                            <div className="card-name">{contact.alias || contact.id}</div>
                                            <div className="card-id">{contact.id}</div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowMenuId(showMenuId === contact.id ? null : contact.id); }}
                                            className="icon-btn"
                                        >
                                            <MoreVertical size={18} />
                                        </button>

                                        {showMenuId === contact.id && (
                                            <div className="menu-popup">
                                                <div onClick={() => { setRemoteId(contact.id); onConnect(); }} className="menu-item">Conectar</div>
                                                <div onClick={() => setEditingContact(contact)} className="menu-item">Renomear</div>
                                                <div onClick={() => onRemoveContact?.(contact.id)} className="menu-item danger">Remover</div>
                                            </div>
                                        )}
                                    </div>

                                    <div
                                        onClick={(e) => { e.stopPropagation(); onUpdateContact?.({ ...contact, isFavorite: !contact.isFavorite }); }}
                                        style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 5, cursor: 'pointer' }}
                                    >
                                        <Star size={18} fill={contact.isFavorite ? "#fbbf24" : "rgba(0,0,0,0.3)"} color={contact.isFavorite ? "#fbbf24" : "#fff"} />
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>

                {/* Footer */}
                <div className="status-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: peerStatus === 'online' ? '#10b981' : '#f59e0b' }}></div>
                        <span>{peerStatus === 'online' ? 'Pronto' : 'Conectando ao servidor...'}</span>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>ID: {myId}</div>
                </div>
            </div>

            {/* Modal Renomear */}
            {editingContact && (
                <div className="modal-overlay">
                    <div className="modal-box">
                        <h3 className="modal-title">Renomear Computador</h3>
                        <p className="modal-desc">Dê um apelido para facilitar a identificação de <strong>{editingContact.id}</strong>.</p>
                        <input
                            autoFocus
                            value={editingContact.alias || ''}
                            onChange={(e) => setEditingContact({ ...editingContact, alias: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateContact?.(editingContact); setEditingContact(null); } }}
                            className="modal-input"
                        />
                        <div className="modal-actions">
                            <button onClick={() => setEditingContact(null)} className="btn-secondary">Cancelar</button>
                            <button onClick={() => { onUpdateContact?.(editingContact); setEditingContact(null); }} className="btn-primary">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Configurações */}
            {showSettings && (
                <div className="modal-overlay">
                    <div className="modal-box">
                        <h3 className="modal-title">Configurações</h3>
                        <p className="modal-desc">Configurações globais da aplicação.</p>

                        <div style={{ marginBottom: '20px' }}>
                            <label className="field-label" style={{ fontWeight: 600, color: '#374151' }}>IP do Servidor (Requer Reinício)</label>
                            <input
                                autoFocus
                                value={tempServerIp}
                                onChange={(e) => setTempServerIp(e.target.value)}
                                placeholder="Ex: 192.168.1.100 ou cloud"
                                className="modal-input"
                                style={{ padding: '12px', border: '1px solid #d1d5db', marginBottom: '5px' }}
                            />
                            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '5px' }}>Deixe em branco ou 'cloud' para usar servidor padrão.</p>
                        </div>

                        <div className="modal-actions">
                            <button onClick={() => { setShowSettings(false); setTempServerIp(serverIp); }} className="btn-secondary">Cancelar</button>
                            <button
                                onClick={() => {
                                    setServerIp(tempServerIp);
                                    setShowSettings(false);
                                    if (tempServerIp !== serverIp) {
                                        if (confirm('O aplicativo precisa ser recarregado para aplicar o novo IP. Recarregar agora?')) {
                                            window.location.reload();
                                        }
                                    }
                                }}
                                className="btn-primary"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
