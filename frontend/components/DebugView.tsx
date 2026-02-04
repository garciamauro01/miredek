import { useState, useEffect, useRef } from 'react';
import { MousePointer2, Keyboard, Trash2, X, Bug } from 'lucide-react';

export function DebugView() {
    const [events, setEvents] = useState<any[]>([]);
    const listEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!window.electronAPI) return;

        const unsubscribe = window.electronAPI.onDebugEvent((data: any) => {
            setEvents(prev => [{ ...data, id: Date.now() + Math.random(), timestamp: new Date().toLocaleTimeString() }, ...prev].slice(0, 100));
        });

        return () => unsubscribe();
    }, []);

    const clearLogs = () => setEvents([]);

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#1a1a1a',
            color: '#e0e0e0',
            fontFamily: 'monospace',
            overflow: 'hidden'
        }}>
            {/* Custom Title Bar for the debug window */}
            <div style={{
                height: '35px',
                background: '#333',
                display: 'flex',
                alignItems: 'center',
                padding: '0 15px',
                justifyContent: 'space-between',
                WebkitAppRegion: 'drag'
            } as React.CSSProperties}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <Bug size={14} color="#f87171" />
                    <span>Mouse Debug (Host)</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                    <button onClick={clearLogs} style={{ background: 'transparent', border: 'none', color: '#999', cursor: 'pointer' }} title="Limpar">
                        <Trash2 size={14} />
                    </button>
                    <button onClick={() => window.electronAPI.closeWindow()} style={{ background: 'transparent', border: 'none', color: '#999', cursor: 'pointer' }}>
                        <X size={14} />
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px', fontSize: '12px' }}>
                {events.length === 0 ? (
                    <div style={{ color: '#666', textAlign: 'center', marginTop: '50px' }}>
                        Aguardando comandos do cliente...
                    </div>
                ) : (
                    events.map(ev => (
                        <div key={ev.id} style={{
                            borderBottom: '1px solid #2a2a2a',
                            padding: '4px 0',
                            display: 'flex',
                            gap: '10px'
                        }}>
                            <span style={{ color: '#666' }}>[{ev.timestamp}]</span>
                            <span style={{ color: ev.type.startsWith('mouse') ? '#60a5fa' : '#c084fc', width: '80px', flexShrink: 0 }}>
                                {ev.type.startsWith('mouse') ? <MousePointer2 size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> : <Keyboard size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />}
                                {ev.type}
                            </span>
                            <span style={{ color: '#fbbf24' }}>
                                {ev.x !== undefined ? `x:${ev.x.toFixed(3)} y:${ev.y.toFixed(3)}` : ''}
                                {ev.key ? ` key: ${ev.key}` : ''}
                                {ev.button ? ` btn: ${ev.button}` : ''}
                            </span>
                        </div>
                    ))
                )}
                <div ref={listEndRef} />
            </div>
        </div>
    );
}


