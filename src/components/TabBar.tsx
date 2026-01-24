import { Plus, X, Home, Monitor } from 'lucide-react';

interface Tab {
    id: string;
    remoteId: string;
    connected: boolean;
    isDashboard?: boolean;
}

interface TabBarProps {
    tabs: Tab[];
    activeTabId: string | null;
    onTabClick: (id: string) => void;
    onTabClose: (id: string) => void;
    onNewTab: () => void;
}

export function TabBar({ tabs, activeTabId, onTabClick, onTabClose, onNewTab }: TabBarProps) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#2d2d2d',
            borderBottom: '1px solid #444',
            height: '40px',
            padding: '0 10px',
            gap: '5px',
            overflowX: 'auto',
            userSelect: 'none'
        }}>
            {/* Dashboard Tab sempre fixa no início */}
            {tabs.filter(t => t.isDashboard).map(tab => (
                <div
                    key={tab.id}
                    onClick={() => onTabClick(tab.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 15px',
                        height: '100%',
                        background: activeTabId === tab.id ? '#444' : 'transparent',
                        borderBottom: activeTabId === tab.id ? '2px solid var(--ad-red)' : '2px solid transparent',
                        cursor: 'pointer',
                        color: activeTabId === tab.id ? '#fff' : '#aaa',
                        transition: 'background 0.2s'
                    }}
                >
                    <Home size={16} />
                    <span style={{ fontSize: '13px', fontWeight: activeTabId === tab.id ? 600 : 400 }}>
                        Início
                    </span>
                </div>
            ))}

            {/* Demais Abas de Sessão */}
            {tabs.filter(t => !t.isDashboard).map(tab => (
                <div
                    key={tab.id}
                    onClick={() => onTabClick(tab.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 15px',
                        height: '100%',
                        background: activeTabId === tab.id ? '#444' : 'transparent',
                        borderBottom: activeTabId === tab.id ? '2px solid var(--ad-red)' : '2px solid transparent',
                        cursor: 'pointer',
                        minWidth: '140px',
                        maxWidth: '220px',
                        color: activeTabId === tab.id ? '#fff' : '#aaa',
                        borderLeft: '1px solid #444',
                        transition: 'background 0.2s'
                    }}
                >
                    <Monitor size={16} color={tab.connected ? '#4CAF50' : '#FF9800'} />
                    <span style={{
                        fontSize: '13px',
                        fontWeight: activeTabId === tab.id ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                    }}>
                        {tab.remoteId || 'Sessão'}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onTabClose(tab.id);
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: 0.6
                        }}
                        className="tab-close-btn"
                        title="Fechar aba"
                    >
                        <X size={14} />
                    </button>
                </div>
            ))}

            {/* Botão de Nova Aba agora no final da lista */}
            <button
                onClick={onNewTab}
                style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    opacity: 0.6,
                    marginLeft: '5px'
                }}
                title="Nova aba de conexão"
            >
                <Plus size={18} />
            </button>
        </div>
    );
}
