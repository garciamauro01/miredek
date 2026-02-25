import { useState } from 'react';
import { Minus, Square, X, ShieldCheck, Zap, Monitor, MessageSquare, Lock, Home, Plus, Maximize, Shrink, StretchHorizontal, ExternalLink, Sun, Moon } from 'lucide-react';

interface Tab {
    id: string;
    remoteId: string;
    connected: boolean;
    isDashboard?: boolean;
    hasNewMessage?: boolean;
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
    hasNewMessage?: boolean;
    // Session Actions
    onChatToggle?: () => void;
    onActionsClick?: () => void;
    onPermissionsClick?: () => void;
    // Monitor switching
    remoteSources?: any[];
    activeSourceId?: string;
    onSourceSelect?: (sourceId: string) => void;
    // ...
    updateAvailable?: { version: string; downloadUrl: string } | null;
    onUpdateClick?: () => void;
    currentViewMode?: 'fit' | 'original' | 'stretch';
    onViewModeSelect?: (mode: 'fit' | 'original' | 'stretch') => void;
    onTabDetach?: (id: string, remoteId: string) => void;
    // Theme
    theme?: 'light' | 'dark';
    onThemeToggle?: () => void;
}

export function CustomTitleBar({
    isSessionActive = false,
    sessionRemoteId = '',
    isSecure = true,
    hasNewMessage = false,
    onChatToggle,
    onActionsClick,
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
    onNewTab,
    currentViewMode = 'fit',
    onViewModeSelect,
    onTabDetach,
    theme = 'dark',
    onThemeToggle
}: CustomTitleBarProps) {
    const [showDisplayMenu, setShowDisplayMenu] = useState(false);

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
            height: 'var(--header-height)',
            background: 'var(--bg-header)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0',
            borderBottom: '1px solid var(--border-color)',
            userSelect: 'none',
            WebkitAppRegion: 'drag',
            transition: 'background-color var(--transition-normal), border-color var(--transition-normal)'
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
                            draggable={!tab.isDashboard}
                            onDragEnd={(e) => {
                                if (tab.isDashboard) return;
                                // Se o arraste terminou fora da área da janela (heuristicamente)
                                // Ou apenas se o usuário arrastou o suficiente para cima/fora.
                                // Em Electron, podemos checar e.screenY.
                                const threshold = 100; // pixels fora da barra
                                if (Math.abs(e.clientY) > threshold || Math.abs(e.clientX) > 2000) {
                                    onTabDetach?.(tab.id, tab.remoteId);
                                }
                            }}
                            onClick={() => onTabClick?.(tab.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '0 15px',
                                height: '38px',
                                minWidth: tab.isDashboard ? 'auto' : '120px',
                                maxWidth: '200px',
                                background: activeTabId === tab.id ? 'var(--bg-surface)' : 'transparent',
                                borderBottom: activeTabId === tab.id ? '2px solid var(--brand-primary)' : 'none',
                                cursor: 'pointer',
                                color: activeTabId === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                                borderRadius: 'var(--border-radius-md) var(--border-radius-md) 0 0',
                                borderRight: activeTabId === tab.id ? 'none' : '1px solid var(--border-color)',
                                marginLeft: tab.isDashboard ? '0' : '0',
                                marginBottom: '-1px',
                                fontSize: '13px',
                                fontWeight: activeTabId === tab.id ? 600 : 400,
                                position: 'relative',
                                transition: 'all var(--transition-fast)'
                            } as any}
                        >
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                {tab.isDashboard ? <Home size={14} /> : <Monitor size={14} color={tab.connected ? '#4CAF50' : '#FF9800'} />}
                                {tab.hasNewMessage && (
                                    <div style={{
                                        position: 'absolute', top: -4, right: -4, width: 8, height: 8,
                                        background: '#e03226', borderRadius: '50%', border: '2px solid #fff'
                                    }}></div>
                                )}
                            </div>
                            <span style={{
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>{tab.isDashboard ? 'Início' : tab.remoteId}</span>

                            {!tab.isDashboard && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onTabDetach?.(tab.id, tab.remoteId); }}
                                        title="Destacar"
                                        style={{
                                            background: 'none', border: 'none', padding: '2px', display: 'flex',
                                            color: '#bbb', cursor: 'pointer'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.color = '#333'}
                                        onMouseLeave={(e) => e.currentTarget.style.color = '#bbb'}
                                    >
                                        <ExternalLink size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onTabClose?.(tab.id); }}
                                        style={{
                                            background: 'none', border: 'none', padding: '2px', display: 'flex',
                                            color: '#bbb', cursor: 'pointer'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.color = '#333'}
                                        onMouseLeave={(e) => e.currentTarget.style.color = '#bbb'}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
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
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', WebkitAppRegion: 'no-drag' } as any}>
                <ToolbarButton
                    icon={theme === 'light' ? <Moon size={20} strokeWidth={2.5} /> : <Sun size={20} strokeWidth={2.5} />}
                    onClick={onThemeToggle}
                    title={theme === 'light' ? 'Tema Escuro' : 'Tema Claro'}
                />

                {isSessionActive && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-active)', height: '70%', padding: '0 12px', borderRadius: 'var(--border-radius-md)', margin: '0 12px', boxShadow: 'var(--shadow-sm)', WebkitAppRegion: 'no-drag' } as any}>
                        {/* Monitor Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--bg-surface)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                            <ShieldCheck size={14} color={isSecure ? '#10b981' : '#f59e0b'} />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{sessionRemoteId}</span>
                        </div>

                        <div style={{ position: 'relative' }}>
                            <ToolbarButton
                                icon={<MessageSquare size={16} />}
                                onClick={onChatToggle}
                                title="Chat"
                            />
                            {hasNewMessage && (
                                <div style={{
                                    position: 'absolute', top: 4, right: 4, width: 8, height: 8,
                                    background: '#e03226', borderRadius: '50%', border: '2px solid #fff',
                                    pointerEvents: 'none'
                                }}></div>
                            )}
                        </div>
                        <ToolbarButton icon={<Zap size={16} />} onClick={onActionsClick} title="Ações" />

                        {/* Display Menu Container */}
                        <div style={{ position: 'relative' }}>
                            <ToolbarButton
                                icon={<Monitor size={16} />}
                                onClick={() => setShowDisplayMenu(!showDisplayMenu)}
                                title="Visualização"
                                active={showDisplayMenu}
                            />
                            {showDisplayMenu && (
                                <div style={{
                                    position: 'absolute',
                                    top: '35px',
                                    right: '0',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--border-radius-md)',
                                    boxShadow: 'var(--shadow-lg)',
                                    zIndex: 1000,
                                    width: '200px',
                                    padding: '8px 0',
                                    overflow: 'hidden'
                                }}>
                                    <DisplayMenuItem
                                        label="Ajustar à Tela"
                                        icon={<Shrink size={14} />}
                                        active={currentViewMode === 'fit'}
                                        onClick={() => { onViewModeSelect?.('fit'); setShowDisplayMenu(false); }}
                                    />
                                    <DisplayMenuItem
                                        label="Tamanho Original"
                                        icon={<Maximize size={14} />}
                                        active={currentViewMode === 'original'}
                                        onClick={() => { onViewModeSelect?.('original'); setShowDisplayMenu(false); }}
                                    />
                                    <DisplayMenuItem
                                        label="Esticar"
                                        icon={<StretchHorizontal size={14} />}
                                        active={currentViewMode === 'stretch'}
                                        onClick={() => { onViewModeSelect?.('stretch'); setShowDisplayMenu(false); }}
                                    />
                                </div>
                            )}
                        </div>

                        <ToolbarButton icon={<Lock size={16} />} onClick={onPermissionsClick} title="Permissões" />

                        {/* Monitor Switchers */}
                        {remoteSources.length > 1 && (
                            <>
                                <div style={{ width: '1px', height: '20px', background: '#ddd', margin: '0 5px' }}></div>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '0 5px' }}>
                                    {remoteSources.map((source, index) => (
                                        <div key={source.id} style={{ WebkitAppRegion: 'no-drag' } as any}>
                                            <button
                                                onClick={() => {
                                                    console.log(`[CustomTitleBar] Click (onClick) Monitor ${index + 1} (id: ${source.id})`);
                                                    onSourceSelect?.(source.id);
                                                }}
                                                onMouseDown={() => {
                                                    console.log(`[CustomTitleBar] Click (onMouseDown) Monitor ${index + 1} (id: ${source.id})`);
                                                    // onSourceSelect?.(source.id); // Evitar duplo disparo se onClick funcionar
                                                }}
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
                                                    cursor: 'pointer',
                                                    WebkitAppRegion: 'no-drag',
                                                    transition: 'all 0.1s ease',
                                                    position: 'relative',
                                                    zIndex: 100,
                                                    pointerEvents: 'auto'
                                                } as any}
                                                onMouseEnter={(e) => activeSourceId !== source.id && (e.currentTarget.style.background = '#e5e5e5')}
                                                onMouseLeave={(e) => activeSourceId !== source.id && (e.currentTarget.style.background = '#f0f0f0')}
                                            >
                                                {index + 1}
                                            </button>
                                        </div>
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
                    <WindowControlButton icon={<Minus size={20} strokeWidth={2.5} />} onClick={handleMinimize} />
                    <WindowControlButton icon={<Square size={16} strokeWidth={2.5} />} onClick={handleMaximize} />
                    <WindowControlButton icon={<X size={20} strokeWidth={2.5} />} onClick={handleClose} isClose />
                </div>
            </div>
        </div>
    );
}

// Sub-componentes para botões
function ToolbarButton({ icon, onClick, title, active = false }: { icon: React.ReactNode, onClick?: () => void, title?: string, active?: boolean }) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                background: active ? 'var(--bg-active)' : 'transparent', border: 'none', cursor: 'pointer',
                padding: '6px', borderRadius: '4px',
                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                WebkitAppRegion: 'no-drag'
            } as any}
            onMouseEnter={(e) => !active && (e.currentTarget.style.background = 'var(--bg-active)')}
            onMouseLeave={(e) => !active && (e.currentTarget.style.background = 'transparent')}
        >
            {icon}
        </button>
    );
}

function DisplayMenuItem({ label, icon, active, onClick }: { label: string, icon: React.ReactNode, active: boolean, onClick: () => void }) {
    return (
        <div
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                cursor: 'pointer',
                background: active ? 'var(--bg-active)' : 'transparent',
                color: active ? 'var(--brand-primary)' : 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: active ? '600' : '400',
                WebkitAppRegion: 'no-drag',
                transition: 'all var(--transition-fast)'
            } as any}
            onMouseEnter={(e) => !active && (e.currentTarget.style.background = 'var(--bg-active)')}
            onMouseLeave={(e) => !active && (e.currentTarget.style.background = 'transparent')}
        >
            {icon}
            <span style={{ flex: 1 }}>{label}</span>
            {active && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand-primary)' }}></div>}
        </div>
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
                color: 'var(--text-primary)',
                transition: 'all var(--transition-fast)'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = isClose ? '#e81123' : 'var(--bg-active)';
                if (isClose) e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-primary)';
            }}
        >
            {icon}
        </button>
    );
}
