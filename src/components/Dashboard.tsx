import { useState } from 'react';
import { Monitor, Settings, Search, Copy, RotateCw, ShieldCheck, Star, Bug, MoreVertical, History as HistoryIcon } from 'lucide-react';
import { useEffect } from 'react';
import type { Contact } from '../types/Contact';

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
    onRemoveContact
}: DashboardProps) {

    const [activeTab, setActiveTab] = useState<'recent' | 'favorites' | 'address' | 'transfers'>('recent');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [showMenuId, setShowMenuId] = useState<string | null>(null);
    const [appVersion, setAppVersion] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [tempServerIp, setTempServerIp] = useState(serverIp);

    // Sincroniza o IP temporário quando o IP real muda (ex: carregamento inicial)
    useEffect(() => {
        setTempServerIp(serverIp);
    }, [serverIp]);

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.getAppVersion().then(setAppVersion);
        }
    }, []);

    // const toggleAutostart = async () => {
    //     if (window.electronAPI) {
    //         const status = await window.electronAPI.setAutostart(!isAutostart);
    //         setIsAutostart(status);
    //     }
    // };

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#f5f6f7', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>

            {/* --- SIDEBAR (ESQUERDA) --- */}
            <div style={{
                width: '300px',
                background: '#fff',
                borderRight: '1px solid #e0e0e0',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '2px 0 10px rgba(0,0,0,0.02)',
                zIndex: 10
            }}>
                <div style={{ padding: '25px', flex: 1, overflowY: 'auto' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 5px 0', color: '#333' }}>Seu Computador</h2>
                    <p style={{ fontSize: '12px', color: '#888', marginBottom: '25px' }}>
                        Seu computador pode ser acessado com este ID e senha.
                    </p>

                    {/* ID Card */}
                    <div style={{
                        background: '#f0f7ff',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '30px',
                        border: '1px solid #dbeafe',
                        position: 'relative'
                    }}>
                        <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Seu ID</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '30px', fontWeight: 500, color: '#1e3a8a', letterSpacing: '1px' }}>
                                {myId || '--- --- ---'}
                            </span>
                            <button onClick={() => navigator.clipboard.writeText(myId)} style={{ background: 'none', border: 'none', color: '#1e40af', cursor: 'pointer', padding: '5px' }}>
                                <Copy size={18} />
                            </button>
                        </div>
                        <button
                            onClick={() => {/* Lógica de convite ou cópia link */ }}
                            style={{
                                marginTop: '15px',
                                width: '100%',
                                padding: '8px',
                                background: '#fff',
                                border: '1px solid #dbeafe',
                                borderRadius: '6px',
                                color: '#1e40af',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Convidar
                        </button>
                    </div>

                    {/* Password Section */}
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#444', marginBottom: '15px' }}>Senhas de Acesso</h3>

                        {/* Senha Temporária */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '5px' }}>Senha Temporária (Sessão)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="text"
                                    readOnly
                                    data-testid="session-password-input"
                                    value={sessionPassword || '...'}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        background: '#f9fafb',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        fontSize: '15px',
                                        fontWeight: 600,
                                        color: '#111',
                                        fontFamily: 'monospace'
                                    }}
                                />
                                <button title="Gerar nova senha" onClick={onRegenerateSessionPassword} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
                                    <RotateCw size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Senha Fixa */}
                        <div>
                            <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '5px' }}>Senha Fixa (Não Supervisionado)</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="password"
                                    value={unattendedPassword}
                                    onChange={(e) => setUnattendedPassword?.(e.target.value)}
                                    placeholder="Definir senha fixa..."
                                    style={{
                                        width: '100%',
                                        padding: '10px 35px 10px 10px',
                                        background: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                <ShieldCheck size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#10b981' }} />
                            </div>
                        </div>
                    </div>

                    {/* App Settings Shortcut */}
                    <div style={{ paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
                        <div
                            onClick={() => {
                                console.log('Botão de configurações clicado!');
                                setShowSettings(true);
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#666', fontSize: '13px', cursor: 'pointer' }}
                        >
                            <Settings size={16} />
                            <span>Configurações</span>
                        </div>
                    </div>
                </div>

                {/* Sidebar Footer (Splash Logo) */}
                <div style={{ padding: '10px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                    <img src="./splash.png" alt="Mire-Desk" style={{ width: '80%', opacity: 0.8 }} />
                    <div style={{ fontSize: '10px', color: '#bbb', marginTop: '5px' }}>Miré-Desk v{appVersion}</div>
                    {/* Debug Button */}
                    <div
                        onClick={() => window.electronAPI?.openDevTools?.()}
                        style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer', color: '#ef4444', fontSize: '10px' }}
                        title="Abrir DevTools (Debug)"
                    >
                        <Bug size={12} />
                        <span>Debug</span>
                    </div>
                </div>
            </div>

            {/* --- MAIN AREA (DIREITA) --- */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 'calc(100% - 300px)' }}>

                {/* Connection Header */}
                <div style={{ padding: '40px 60px', background: '#fff', borderBottom: '1px solid #e0e0e0' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#111', margin: '0 0 25px 0' }}>Controle um Computador Remoto</h1>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', maxWidth: '700px' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <input
                                type="text"
                                value={remoteId}
                                onChange={(e) => setRemoteId(e.target.value)}
                                placeholder="Insira o ID da mesa remota..."
                                style={{
                                    width: '100%',
                                    padding: '15px 20px',
                                    fontSize: '18px',
                                    borderRadius: '10px',
                                    border: '2px solid #e5e7eb',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    boxSizing: 'border-box'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                            />
                        </div>
                        <button
                            onClick={onConnect}
                            style={{
                                padding: '15px 35px',
                                background: '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '16px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Conectar
                        </button>
                    </div>
                </div>

                {/* Content Area (Recent, Favorites, etc.) */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '30px 60px' }}>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '30px', marginBottom: '25px', borderBottom: '1px solid #e0e0e0' }}>
                        {[
                            { id: 'recent', label: 'Sessões Recentes' },
                            { id: 'favorites', label: 'Favoritos' },
                            { id: 'address', label: 'Lista de Endereços' },
                            { id: 'transfers', label: 'Transferências' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                style={{
                                    padding: '10px 5px',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: activeTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent',
                                    color: activeTab === tab.id ? '#3b82f6' : '#666',
                                    fontWeight: activeTab === tab.id ? 700 : 500,
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Search in Content */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                        <div style={{ position: 'relative', width: '250px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                            <input
                                type="text"
                                placeholder="Pesquisar ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 10px 8px 35px',
                                    borderRadius: '6px',
                                    border: '1px solid #e5e7eb',
                                    fontSize: '13px',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>

                    {/* Main Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                        gap: '25px'
                    }}>
                        {(() => {
                            if (activeTab === 'transfers') {
                                return (
                                    <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px dashed #ddd' }}>
                                        <HistoryIcon size={48} style={{ color: '#ccc', marginBottom: '15px' }} />
                                        <div style={{ color: '#666' }}>Nenhuma transferência nos registros.</div>
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
                                    <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#999' }}>
                                        Nenhum computador encontrado.
                                    </div>
                                );
                            }

                            return filtered.map((contact) => (
                                <div
                                    key={contact.id}
                                    onDoubleClick={() => { setRemoteId(contact.id); setTimeout(onConnect, 50); }}
                                    onClick={() => onSelectRecent?.(contact.id)}
                                    style={{
                                        background: '#fff',
                                        borderRadius: '12px',
                                        border: '1px solid #e5e7eb',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                        position: 'relative'
                                    }}
                                    className="ad-hover-card"
                                >
                                    {/* Thumbnail 16:9 */}
                                    <div style={{ width: '100%', paddingTop: '56.25%', background: '#111', position: 'relative' }}>
                                        {contact.thumbnail ? (
                                            <img src={contact.thumbnail} style={{ position: 'absolute', top: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ position: 'absolute', top: 0, width: '100%', height: '100%', background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Monitor size={48} color="rgba(255,255,255,0.2)" />
                                            </div>
                                        )}

                                        {/* Status Dot */}
                                        <div style={{
                                            position: 'absolute', bottom: '10px', left: '10px', width: '10px', height: '10px',
                                            borderRadius: '50%', background: recentStatusMap[contact.id] === 'online' ? '#10b981' : '#ef4444',
                                            border: '2px solid #fff', boxShadow: '0 0 5px rgba(0,0,0,0.2)'
                                        }}></div>
                                    </div>

                                    {/* Info Panel */}
                                    <div style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ overflow: 'hidden' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                {contact.alias || contact.id}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>{contact.id}</div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowMenuId(showMenuId === contact.id ? null : contact.id); }}
                                            style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}
                                        >
                                            <MoreVertical size={18} />
                                        </button>

                                        {showMenuId === contact.id && (
                                            <div style={{ position: 'absolute', bottom: '15px', right: '15px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', zIndex: 100, width: '150px', padding: '5px 0' }}>
                                                <div onClick={() => { setRemoteId(contact.id); onConnect(); }} className="ad-menu-item" style={{ padding: '10px 15px', fontSize: '13px', cursor: 'pointer' }}>Conectar</div>
                                                <div onClick={() => setEditingContact(contact)} className="ad-menu-item" style={{ padding: '10px 15px', fontSize: '13px', cursor: 'pointer' }}>Renomear</div>
                                                <div onClick={() => onRemoveContact?.(contact.id)} className="ad-menu-item" style={{ padding: '10px 15px', fontSize: '13px', cursor: 'pointer', color: '#ef4444' }}>Remover</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Favorite Star */}
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

                {/* Status Bar (Footer) */}
                <div style={{
                    height: '25px',
                    background: '#f8f9fa',
                    borderTop: '1px solid #e0e0e0',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 20px',
                    fontSize: '11px',
                    color: '#888'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: peerStatus === 'online' ? '#10b981' : '#f59e0b' }}></div>
                        <span>{peerStatus === 'online' ? 'Pronto' : 'Conectando ao servidor...'}</span>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>ID: {myId}</div>
                </div>
            </div>

            {/* Modal Renomear */}
            {editingContact && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000 }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '380px', padding: '30px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 600 }}>Renomear Computador</h3>
                        <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>Dê um apelido para facilitar a identificação de <strong>{editingContact.id}</strong>.</p>
                        <input
                            autoFocus
                            value={editingContact.alias || ''}
                            onChange={(e) => setEditingContact({ ...editingContact, alias: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateContact?.(editingContact); setEditingContact(null); } }}
                            style={{
                                width: '100%',
                                padding: '12px',
                                border: '2px solid #3b82f6',
                                borderRadius: '10px',
                                fontSize: '15px',
                                outline: 'none',
                                boxSizing: 'border-box',
                                marginBottom: '25px'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditingContact(null)} style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', color: '#4b5563', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                            <button onClick={() => { onUpdateContact?.(editingContact); setEditingContact(null); }} style={{ padding: '10px 25px', background: '#3b82f6', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Configurações */}
            {showSettings && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000 }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '380px', padding: '30px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 600 }}>Configurações</h3>
                        <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>Configurações globais da aplicação.</p>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '8px' }}>IP do Servidor (Requer Reinício)</label>
                            <input
                                autoFocus
                                value={tempServerIp}
                                onChange={(e) => setTempServerIp(e.target.value)}
                                placeholder="Ex: 192.168.1.100 ou cloud"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '5px' }}>Deixe em branco ou 'cloud' para usar servidor padrão.</p>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => { setShowSettings(false); setTempServerIp(serverIp); }}
                                style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', color: '#4b5563', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Cancelar
                            </button>
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
                                style={{ padding: '10px 25px', background: '#3b82f6', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
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
