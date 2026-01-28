import { useState } from 'react';
import { Monitor, ArrowRight, Copy, RotateCw, Settings, ShieldCheck, Star, MoreVertical, History } from 'lucide-react';
import { useEffect } from 'react';
import type { Contact } from '../types/Contact';
import { Search, X } from 'lucide-react';

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
    tempPassword?: string;
    setTempPassword?: (password: string) => void;
    recentSessions?: string[];
    onSelectRecent?: (id: string) => void;
    recentStatusMap?: { [id: string]: 'online' | 'offline' | 'checking' };
    peerStatus?: 'online' | 'offline' | 'connecting';
    contacts?: Contact[];
    onUpdateContact?: (contact: Contact) => void;
    onRemoveContact?: (id: string) => void;
}

export function Dashboard({
    myId, serverIp, setServerIp,
    remoteId, setRemoteId, onConnect, onResetId, logs,
    sessions = [], onCloseSession,
    unattendedPassword, setUnattendedPassword,
    tempPassword, setTempPassword,
    recentSessions = [], onSelectRecent,
    recentStatusMap = {},
    peerStatus = 'offline',
    contacts = [],
    onUpdateContact,
    onRemoveContact
}: DashboardProps) {

    const [activeTab, setActiveTab] = useState<'recent' | 'favorites' | 'address' | 'transfers'>('recent');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [showMenuId, setShowMenuId] = useState<string | null>(null);
    const [isAutostart, setIsAutostart] = useState(false);
    const [appVersion, setAppVersion] = useState('');

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.getAutostartStatus().then(setIsAutostart);
            window.electronAPI.getAppVersion().then(setAppVersion);
        }
    }, []);

    const toggleAutostart = async () => {
        if (window.electronAPI) {
            const status = await window.electronAPI.setAutostart(!isAutostart);
            setIsAutostart(status);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', background: 'var(--ad-sidebar-bg)', overflow: 'hidden' }}>
            <div style={{ height: '50px', background: '#ffffff', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <img src="/icon.png" alt="Logo" style={{ height: '32px', marginRight: '10px', borderRadius: '4px' }} />
                    <span style={{ fontWeight: 600, fontSize: '18px', color: '#333' }}>Miré-Desk</span>
                </div>
                {appVersion && (
                    <span style={{ fontSize: '12px', color: '#999', background: '#f5f5f5', padding: '2px 8px', borderRadius: '10px', border: '1px solid #eee' }}>
                        v{appVersion}
                    </span>
                )}
            </div>

            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

                {/* Left Column: This Desk (My ID) */}
                <div className="ad-card">
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', color: 'var(--ad-text-secondary)' }}>
                        <Monitor size={18} style={{ marginRight: '8px' }} />
                        <span style={{ fontSize: '14px', fontWeight: 500 }}>Este Computador</span>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <label style={{ fontSize: '11px', color: '#888' }}>O seu endereço</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: peerStatus === 'online' ? '#4CAF50' : peerStatus === 'connecting' ? '#FFC107' : '#F44336'
                                }}></div>
                                <span style={{ fontSize: '10px', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>
                                    {peerStatus === 'online' ? 'Online' : peerStatus === 'connecting' ? 'Conectando...' : 'Offline'}
                                </span>
                            </div>
                        </div>
                        {!window.electronAPI ? (
                            // Navegador: Bloqueia uso como Host
                            <div style={{
                                background: '#fff3cd',
                                border: '1px solid #ffc107',
                                borderRadius: '6px',
                                padding: '15px',
                                marginTop: '10px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '20px' }}>⚠️</span>
                                    <strong style={{ color: '#856404' }}>Modo Host Desabilitado</strong>
                                </div>
                                <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#856404', lineHeight: '1.5' }}>
                                    Para <strong>receber conexões</strong> e permitir que outros controlem este computador,
                                    você precisa instalar o <strong>Miré-Desk Desktop</strong>.
                                </p>
                                <p style={{ margin: '0', fontSize: '12px', color: '#856404' }}>
                                    💡 <em>Você ainda pode usar o navegador para <strong>conectar-se a outros computadores</strong> normalmente.</em>
                                </p>
                            </div>
                        ) : (
                            // App Desktop: Funciona normalmente
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontSize: '28px', fontWeight: 400, color: '#333', letterSpacing: '1px' }}>
                                    {myId || '--- --- ---'}
                                </span>
                                <button onClick={() => navigator.clipboard.writeText(myId)} title="Copiar" style={{ background: 'none', border: 'none', marginLeft: '10px', color: '#888' }}>
                                    <Copy size={16} />
                                </button>
                                <button onClick={onResetId} title="Gerar Novo ID" style={{ background: 'none', border: 'none', marginLeft: '5px', color: '#888' }}>
                                    <RotateCw size={16} />
                                </button>
                            </div>
                        )}
                        {logs.some(l => l.includes('unavailable-id')) && <span style={{ color: 'red', fontSize: '11px' }}>ID Indisponível (Em uso)</span>}
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '15px 0' }} />

                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '11px', color: '#888' }}>Configuração de Rede (VPN/IP)</label>
                        <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                            <input
                                type="text"
                                className="ad-input"
                                value={serverIp}
                                onChange={(e) => setServerIp(e.target.value)}
                                style={{ flex: 1 }}
                                placeholder="IP do Servidor"
                            />
                            <button onClick={() => window.location.reload()} style={{ padding: '5px', border: '1px solid #ddd', background: '#fff', borderRadius: '3px' }}>
                                <RotateCw size={14} />
                            </button>
                        </div>
                        <small style={{ color: '#999', fontSize: '10px' }}>Altere se estiver usando VPN (ex: 10.8.0.x)</small>
                    </div>

                    {/* Lista de Sessões Ativas (Host) */}
                    {sessions.filter(s => s.isIncoming && s.connected).length > 0 && (
                        <>
                            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '15px 0' }} />
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '8px' }}>Usuários Conectados a Você</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {sessions.filter(s => s.isIncoming && s.connected).map(s => (
                                        <div key={s.id} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            background: '#f8f9fa', padding: '8px 12px', borderRadius: '4px',
                                            border: '1px solid #eee'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4CAF50' }}></div>
                                                <span style={{ fontSize: '13px', fontWeight: 500, color: '#333' }}>{s.remoteId}</span>
                                            </div>
                                            <button
                                                onClick={() => onCloseSession?.(s.id)}
                                                style={{
                                                    background: '#fee2e2', color: '#dc2626', border: 'none',
                                                    padding: '4px 8px', borderRadius: '4px', fontSize: '11px',
                                                    cursor: 'pointer', fontWeight: 600
                                                }}
                                            >
                                                Desconectar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '15px 0' }} />

                    <div style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', color: 'var(--ad-text-secondary)' }}>
                            <Settings size={16} style={{ marginRight: '8px' }} />
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>Configurações do App</span>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px', fontSize: '13px', color: '#555' }}>
                            <input
                                type="checkbox"
                                checked={isAutostart}
                                onChange={toggleAutostart}
                                style={{ width: '16px', height: '16px' }}
                            />
                            Iniciar com o Windows
                        </label>
                        <p style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
                            O aplicativo ficará minimizado na bandeja do sistema ao fechar.
                        </p>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '15px 0' }} />

                    <div style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', color: 'var(--ad-text-secondary)' }}>
                            <ShieldCheck size={16} style={{ marginRight: '8px', color: '#059669' }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#059669' }}>Acesso Não Supervisionado</span>
                        </div>
                        <input
                            type="password"
                            className="ad-input"
                            value={unattendedPassword}
                            onChange={(e) => setUnattendedPassword?.(e.target.value)}
                            placeholder="Definir senha secreta..."
                            style={{ width: '100%', marginBottom: '5px', border: '1px solid #059669' }}
                        />
                        <small style={{ color: '#666', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                            <strong>Segurança:</strong> Use esta senha para acessar de outro lugar sem precisar clicar em "Aceitar".
                        </small>
                    </div>
                </div>

                {/* Right Column: Remote Desk */}
                <div>
                    <div className="ad-card" style={{ padding: '40px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <label style={{ fontSize: '14px', color: 'var(--ad-text-secondary)', marginBottom: '10px' }}>Outra Área de Trabalho</label>
                        <div style={{ display: 'flex', gap: '10px', height: '48px' }}>
                            <input
                                type="text"
                                value={remoteId}
                                onChange={(e) => setRemoteId(e.target.value)}
                                className="ad-input"
                                placeholder="Insira o ID da mesa remota..."
                                style={{ flex: 1, fontSize: '18px', padding: '10px' }}
                            />
                            <button
                                onClick={onConnect}
                                className="ad-btn-primary"
                                style={{ padding: '0 30px', fontSize: '14px', display: 'flex', alignItems: 'center' }}
                            >
                                Conectar <ArrowRight size={16} style={{ marginLeft: '5px' }} />
                            </button>
                        </div>
                        <div style={{ marginTop: '10px' }}>
                            <input
                                type="password"
                                value={tempPassword}
                                onChange={(e) => setTempPassword?.(e.target.value)}
                                className="ad-input"
                                placeholder="Senha de acesso (opcional)..."
                                style={{ width: '100%', fontSize: '13px' }}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: '30px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', borderBottom: '2px solid transparent' }}>
                            <button
                                onClick={() => setActiveTab('recent')}
                                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'recent' ? '2px solid var(--ad-red)' : 'none', padding: '5px 15px', fontWeight: 600, color: activeTab === 'recent' ? 'var(--ad-red)' : '#666' }}>
                                Sessões Recentes
                            </button>
                            <button
                                onClick={() => setActiveTab('favorites')}
                                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'favorites' ? '2px solid var(--ad-red)' : 'none', padding: '5px 15px', fontWeight: 600, color: activeTab === 'favorites' ? 'var(--ad-red)' : '#666' }}>
                                Favoritos
                            </button>
                            <button
                                onClick={() => setActiveTab('address')}
                                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'address' ? '2px solid var(--ad-red)' : 'none', padding: '5px 15px', fontWeight: 600, color: activeTab === 'address' ? 'var(--ad-red)' : '#666' }}>
                                Lista de Endereços
                            </button>
                            <button
                                onClick={() => setActiveTab('transfers')}
                                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'transfers' ? '2px solid var(--ad-red)' : 'none', padding: '5px 15px', fontWeight: 600, color: activeTab === 'transfers' ? 'var(--ad-red)' : '#666' }}>
                                Transferências
                            </button>
                        </div>

                        <div style={{ background: '#fff', border: '1px solid #ddd', padding: '15px', borderRadius: '4px', minHeight: '300px' }}>
                            {/* Search Bar */}
                            <div style={{ position: 'relative', marginBottom: '15px' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                                <input
                                    type="text"
                                    placeholder="Pesquisar por ID ou nome..."
                                    className="ad-input"
                                    style={{ width: '100%', paddingLeft: '35px', fontSize: '13px' }}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <X
                                        size={14}
                                        onClick={() => setSearchTerm('')}
                                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999', cursor: 'pointer' }}
                                    />
                                )}
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                                gap: '15px',
                                background: '#f8f9fa',
                                padding: '15px',
                                borderRadius: '8px',
                                minHeight: '200px',
                                alignItems: 'start'
                            }}>
                                {(() => {
                                    if (activeTab === 'transfers') {
                                        return (
                                            <div style={{ gridColumn: '1 / -1', padding: '20px', color: '#666' }}>
                                                <h4 style={{ margin: '0 0 10px 0' }}>Histórico de Transferências</h4>
                                                <div style={{ fontSize: '13px', background: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
                                                    {logs.filter(l => l.toLowerCase().includes('arquivo')).length > 0 ? (
                                                        logs.filter(l => l.toLowerCase().includes('arquivo')).map((l, i) => (
                                                            <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>{l}</div>
                                                        ))
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px', opacity: 0.6 }}>
                                                            <History size={32} style={{ marginBottom: '10px' }} />
                                                            <span>Nenhuma transferência registrada recentemente.</span>
                                                        </div>
                                                    )}
                                                </div>
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
                                            <div key="empty" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#999' }}>
                                                <History size={48} style={{ opacity: 0.2, marginBottom: '10px', display: 'inline-block' }} />
                                                <p>Nenhum endereço encontrado.</p>
                                            </div>
                                        );
                                    }

                                    return filtered.map((contact: Contact) => {
                                        const id = contact.id;
                                        return (
                                            <div
                                                key={id}
                                                onClick={() => onSelectRecent?.(id)}
                                                onDoubleClick={() => {
                                                    // Duplo clique: conecta automaticamente com senha salva
                                                    setRemoteId(id);
                                                    if (contact.password) {
                                                        setTempPassword?.(contact.password);
                                                    }
                                                    // Pequeno delay para garantir que os estados foram atualizados
                                                    setTimeout(() => onConnect(), 50);
                                                }}
                                                style={{
                                                    background: '#fff',
                                                    borderRadius: '6px',
                                                    border: '1px solid #ddd',
                                                    overflow: 'hidden',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    position: 'relative',
                                                    transition: 'transform 0.2s, box-shadow 0.2s'
                                                }} className="ad-session-card">
                                                {/* Thumbnail Area */}
                                                <div style={{ height: '100px', background: '#111', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                    {contact.thumbnail ? (
                                                        <img
                                                            src={contact.thumbnail}
                                                            alt="Snapshot"
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                    ) : (
                                                        <div style={{
                                                            width: '100%', height: '100%',
                                                            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8
                                                        }}>
                                                            <Monitor size={40} color="#fff" style={{ opacity: 0.2 }} />
                                                        </div>
                                                    )}

                                                    <div style={{
                                                        position: 'absolute', top: '8px', left: '8px', width: '10px', height: '10px',
                                                        borderRadius: '50%', background: recentStatusMap[id] === 'online' ? '#4CAF50' : '#f44336',
                                                        border: '1.5px solid #fff', boxShadow: '0 0 4px rgba(0,0,0,0.3)', zIndex: 2
                                                    }}></div>

                                                    <div onClick={(e) => { e.stopPropagation(); onUpdateContact?.({ ...contact, isFavorite: !contact.isFavorite }); }}
                                                        style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, cursor: 'pointer' }}>
                                                        <Star size={16} fill={contact.isFavorite ? "#fbbf24" : "none"} color={contact.isFavorite ? "#fbbf24" : "#fff"} />
                                                    </div>
                                                </div>

                                                {/* Bottom Info Bar */}
                                                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                                                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {contact.alias || id}
                                                        </span>
                                                        {contact.alias && <span style={{ fontSize: '10px', color: '#999' }}>{id}</span>}
                                                    </div>
                                                    <div style={{ position: 'relative' }}>
                                                        <button onClick={(e) => { e.stopPropagation(); setShowMenuId(showMenuId === id ? null : id); }}
                                                            style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', padding: '2px' }}>
                                                            <MoreVertical size={16} />
                                                        </button>
                                                        {showMenuId === id && (
                                                            <div style={{ position: 'absolute', bottom: '25px', right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, width: '140px', padding: '5px 0' }}>
                                                                <div onClick={(e) => { e.stopPropagation(); onConnect(); setShowMenuId(null); }} className="ad-menu-item">Conectar</div>
                                                                <div onClick={(e) => { e.stopPropagation(); setEditingContact(contact); setShowMenuId(null); }} className="ad-menu-item">Renomear</div>
                                                                <div onClick={(e) => { e.stopPropagation(); onRemoveContact?.(id); setShowMenuId(null); }} className="ad-menu-item" style={{ color: 'red' }}>Remover</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        {/* Modal Renomear */}
                        {editingContact && (
                            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                                <div className="ad-card" style={{ width: '350px', padding: '25px' }}>
                                    <h3 style={{ marginTop: 0, fontSize: '16px', marginBottom: '20px' }}>Renomear Endereço</h3>
                                    <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '5px' }}>Novo nome para {editingContact.id}</label>
                                    <input
                                        autoFocus
                                        className="ad-input"
                                        style={{ width: '100%', marginBottom: '20px' }}
                                        value={editingContact.alias || ''}
                                        onChange={(e) => setEditingContact({ ...editingContact, alias: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                onUpdateContact?.(editingContact);
                                                setEditingContact(null);
                                            } else if (e.key === 'Escape') {
                                                setEditingContact(null);
                                            }
                                        }}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                        <button onClick={() => setEditingContact(null)} className="ad-btn-secondary" style={{ padding: '8px 15px', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
                                        <button onClick={() => { onUpdateContact?.(editingContact); setEditingContact(null); }} className="ad-btn-primary" style={{ padding: '8px 20px' }}>Salvar</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Footer/Logs */}
            <div style={{ marginTop: 'auto', background: '#222', color: '#aaa', padding: '10px', fontSize: '11px', height: '150px', overflowY: 'auto' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#fff' }}>Log de Eventos:</div>
                {logs.map((log, i) => <div key={i}>{log}</div>)}
            </div>
        </div >
    );
}
