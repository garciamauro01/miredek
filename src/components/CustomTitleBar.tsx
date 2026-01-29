import { Minus, Square, X, ShieldCheck, Zap, Monitor, MessageSquare, Lock, Home, Plus } from 'lucide-react';

interface Tab {
    id: string;
    remoteId: string;
    connected: boolean;
    isDashboard?: boolean;
}

interface CustomTitleBarProps {
    title?: string;
    // Tabs
    tabs?: Tab[];
    activeTabId?: string | null;
    onTabClick?: (id: string) => void;
    onTabClose?: (id: string) => void;
    onNewTab?: () => void;
    // Session (current active)
    isSessionActive?: boolean;
    sessionRemoteId?: string;
    isSecure?: boolean;
    // Session Actions
    onChatToggle?: () => void;
    onActionsClick?: () => void;
    onDisplayClick?: () => void;
    onPermissionsClick?: () => void;
    // Monitor switching
    remoteSources?: any[];
    activeSourceId?: string;
    onSourceSelect?: (sourceId: string) => void;
    // ...
    updateAvailable?: { version: string; downloadUrl: string } | null;
    onUpdateClick?: () => void;
}

export function CustomTitleBar({
    isSessionActive = false,
    sessionRemoteId = '',
    isSecure = true,
    onChatToggle,
    onActionsClick,
    onDisplayClick,
    onPermissionsClick,
    remoteSources = [],
    activeSourceId,
    onSourceSelect,
    updateAvailable,
    onUpdateClick,
    tabs = [],
    activeTabId,
    onTabClick,
    onTabClose,
    onNewTab
}: CustomTitleBarProps) {

    const handleMinimize = () => {
        if (window.electronAPI) window.electronAPI.minimizeWindow();
    };

    const handleMaximize = () => {
        if (window.electronAPI) window.electronAPI.maximizeWindow();
    };

    const handleClose = () => {
        if (window.electronAPI) window.electronAPI.closeWindow();
    };

    return (
        <div style={{
            height: '40px',
            background: '#ececec',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0',
            borderBottom: '1px solid #ddd',
            userSelect: 'none',
            WebkitAppRegion: 'drag'
        } as any}>

            {/* Esquerda: Logo e Abas */}
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', flex: 1, overflow: 'hidden' }}>
                <div style={{ padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                    <img src="/icon.png" alt="" style={{ width: '22px', height: '22px', borderRadius: '4px' }} />
                </div>

                {/* Tabs Container */}
                <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', gap: '1px', WebkitAppRegion: 'no-drag' } as any}>
                    {tabs.map(tab => (
                        <div
                            key={tab.id}
                            onClick={() => onTabClick?.(tab.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '0 15px',
                                height: '34px',
                                minWidth: tab.isDashboard ? 'auto' : '120px',
                                maxWidth: '200px',
                                background: activeTabId === tab.id ? '#ffffff' : 'transparent',
                                borderBottom: activeTabId === tab.id ? '2px solid #e03226' : 'none',
                                cursor: 'pointer',
                                color: activeTabId === tab.id ? '#333' : '#666',
                                borderRadius: '6px 6px 0 0',
                                borderRight: activeTabId === tab.id ? 'none' : '1px solid #dcdcdc',
                                marginLeft: tab.isDashboard ? '0' : '0',
                                marginBottom: '-1px',
                                fontSize: '12px',
                                fontWeight: activeTabId === tab.id ? 600 : 400
                            } as any}
                        >
                            {tab.isDashboard ? <Home size={14} /> : <Monitor size={14} color={tab.connected ? '#4CAF50' : '#FF9800'} />}
                            <span style={{
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>{tab.isDashboard ? 'Início' : tab.remoteId}</span>

                            {!tab.isDashboard && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onTabClose?.(tab.id); }}
                                    style={{
                                        background: 'none', border: 'none', padding: '2px', display: 'flex',
                                        color: '#999', cursor: 'pointer', marginLeft: 'auto'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#333'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#999'}
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    ))}

                    <button
                        onClick={onNewTab}
                        style={{
                            background: 'none', border: 'none', padding: '6px',
                            display: 'flex', alignItems: 'center', cursor: 'pointer',
                            color: '#666', height: '34px'
                        } as any}
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* Centro / Direita: Info Sessão e Ações (Mostra apenas se tiver sessão ativa e não for dashboard) */}
            {isSessionActive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#ffffff', height: '100%', padding: '0 10px', boxShadow: '-5px 0 10px rgba(0,0,0,0.05)', WebkitAppRegion: 'no-drag' } as any}>
                    {/* Monitor Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '10px', padding: '4px 8px', background: '#f5f5f5', borderRadius: '4px' }}>
                        <ShieldCheck size={14} color={isSecure ? '#4CAF50' : '#FF9800'} />
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>{sessionRemoteId}</span>
                        {/* Monitor switchers simplificados aqui se necessário */}
                    </div>

                    <ToolbarButton icon={<MessageSquare size={16} />} onClick={onChatToggle} title="Chat" />
                    <ToolbarButton icon={<Zap size={16} />} onClick={onActionsClick} title="Ações" />
                    <ToolbarButton icon={<Monitor size={16} />} onClick={onDisplayClick} title="Display" />
                    <ToolbarButton icon={<Lock size={16} />} onClick={onPermissionsClick} title="Permissões" />

                    {/* Monitor Switchers */}
                    {remoteSources.length > 1 && (
                        <>
                            <div style={{ width: '1px', height: '20px', background: '#ddd', margin: '0 5px' }}></div>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '0 5px' }}>
                                {remoteSources.map((source, index) => (
                                    <button
                                        key={source.id}
                                        onClick={() => onSourceSelect?.(source.id)}
                                        title={`Monitor ${index + 1}`}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: activeSourceId === source.id ? '#e03226' : '#f0f0f0',
                                            color: activeSourceId === source.id ? '#fff' : '#666',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {index + 1}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    <div style={{ width: '1px', height: '20px', background: '#ddd', margin: '0 5px' }}></div>

                    {updateAvailable && (
                        <button
                            onClick={onUpdateClick}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                background: '#e03226', color: 'white', border: 'none',
                                padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            UPDATE
                        </button>
                    )}
                </div>
            )}

            {/* Controles de Janela */}
            <div style={{ display: 'flex', height: '100%', WebkitAppRegion: 'no-drag' } as any}>
                <WindowControlButton icon={<Minus size={16} />} onClick={handleMinimize} />
                <WindowControlButton icon={<Square size={14} />} onClick={handleMaximize} />
                <WindowControlButton icon={<X size={16} />} onClick={handleClose} isClose />
            </div>
        </div>
    );
}

// Sub-componentes para botões
function ToolbarButton({ icon, onClick, title }: { icon: React.ReactNode, onClick?: () => void, title?: string }) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '6px', borderRadius: '4px',
                color: '#555', display: 'flex', alignItems: 'center'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
            {icon}
        </button>
    );
}

function WindowControlButton({ icon, onClick, isClose = false }: { icon: React.ReactNode, onClick: () => void, isClose?: boolean }) {
    return (
        <button
            onClick={onClick}
            style={{
                background: 'transparent',
                border: 'none',
                width: '46px',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#333',
                transition: 'background 0.1s'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = isClose ? '#e81123' : '#e5e5e5';
                if (isClose) e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                if (isClose) e.currentTarget.style.color = '#333';
            }}
        >
            {icon}
        </button>
    );
}
