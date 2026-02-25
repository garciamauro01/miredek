import { useState } from 'react';
import { Settings, Wifi, WifiOff, Activity } from 'lucide-react';
import type { NetworkMetrics, QualityLevel } from '../hooks/useNetworkQuality';

interface QualityControlProps {
    metrics: NetworkMetrics;
    currentQuality: QualityLevel;
    qualityPresets: QualityLevel[];
    isAdaptive: boolean;
    isManual: boolean;
    onSetManualQuality: (level: number) => void;
    onEnableAdaptive: () => void;
}

export function QualityControl({
    metrics,
    currentQuality,
    qualityPresets,
    isAdaptive,
    isManual,
    onSetManualQuality,
    onEnableAdaptive
}: QualityControlProps) {
    const [showPanel, setShowPanel] = useState(false);

    // Determine connection quality indicator
    const getQualityColor = () => {
        if (metrics.rtt > 200 || metrics.packetLoss > 0.05) return '#E74C3C'; // Red
        if (metrics.rtt > 100 || metrics.packetLoss > 0.02) return '#F39C12'; // Orange
        if (metrics.rtt > 50 || metrics.packetLoss > 0.01) return '#F1C40F';  // Yellow
        return '#2ECC71'; // Green
    };

    const getSignalStrength = () => {
        if (metrics.rtt > 200) return 1;
        if (metrics.rtt > 100) return 2;
        if (metrics.rtt > 50) return 3;
        return 4;
    };

    return (
        <div className="quality-control">
            {/* Quality Indicator Button */}
            <button
                className="quality-indicator-btn"
                onClick={() => setShowPanel(!showPanel)}
                title="Configurações de Qualidade"
                style={{
                    background: 'rgba(0, 0, 0, 0.7)',
                    border: `2px solid ${getQualityColor()}`,
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px'
                }}
            >
                {getSignalStrength() > 2 ? (
                    <Wifi size={16} color={getQualityColor()} />
                ) : (
                    <WifiOff size={16} color={getQualityColor()} />
                )}
                <span>{currentQuality.description}</span>
                <Settings size={14} />
            </button>

            {/* Quality Control Panel */}
            {showPanel && (
                <div
                    className="quality-panel"
                    style={{
                        position: 'absolute',
                        top: '40px',
                        right: '0',
                        background: 'rgba(20, 20, 30, 0.95)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '16px',
                        minWidth: '300px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                        zIndex: 1000
                    }}
                >
                    {/* Header */}
                    <div style={{ marginBottom: '16px' }}>
                        <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '14px', fontWeight: 600 }}>
                            Controle de Qualidade
                        </h3>
                        <div style={{ fontSize: '11px', color: '#aaa' }}>
                            {isAdaptive && !isManual ? '🔄 Modo Adaptativo Ativo' : '✋ Modo Manual'}
                        </div>
                    </div>

                    {/* Network Metrics */}
                    <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <Activity size={14} color={getQualityColor()} />
                            <span style={{ fontSize: '12px', color: '#fff', fontWeight: 500 }}>Métricas de Rede</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#ccc', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <div>
                                <span style={{ color: '#888' }}>Latência:</span> {metrics.rtt.toFixed(0)}ms
                            </div>
                            <div>
                                <span style={{ color: '#888' }}>Perda:</span> {(metrics.packetLoss * 100).toFixed(1)}%
                            </div>
                            <div>
                                <span style={{ color: '#888' }}>Jitter:</span> {metrics.jitter.toFixed(0)}ms
                            </div>
                            <div>
                                <span style={{ color: '#888' }}>Bitrate:</span> {(metrics.bitrate / 1000000).toFixed(1)} Mbps
                            </div>
                        </div>
                    </div>

                    {/* Current Quality Info */}
                    <div style={{ marginBottom: '16px', padding: '10px', background: 'rgba(52, 152, 219, 0.1)', borderRadius: '6px', border: '1px solid rgba(52, 152, 219, 0.3)' }}>
                        <div style={{ fontSize: '11px', color: '#3498DB', marginBottom: '4px', fontWeight: 500 }}>
                            Qualidade Atual: Nível {currentQuality.level}
                        </div>
                        <div style={{ fontSize: '10px', color: '#aaa' }}>
                            JPEG: {currentQuality.jpegQuality}% | Blocos: {currentQuality.blockSize}px | 
                            Taxa: {currentQuality.targetBitrate} Mbps
                        </div>
                    </div>

                    {/* Quality Presets */}
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '8px', fontWeight: 500 }}>
                            Selecionar Qualidade:
                        </div>
                        {qualityPresets.map((preset) => (
                            <button
                                key={preset.level}
                                onClick={() => onSetManualQuality(preset.level)}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '8px 12px',
                                    marginBottom: '6px',
                                    background: currentQuality.level === preset.level
                                        ? 'rgba(52, 152, 219, 0.3)'
                                        : 'rgba(255, 255, 255, 0.05)',
                                    border: currentQuality.level === preset.level
                                        ? '1px solid #3498DB'
                                        : '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    if (currentQuality.level !== preset.level) {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (currentQuality.level !== preset.level) {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    }
                                }}
                            >
                                <div style={{ fontWeight: 500, marginBottom: '2px' }}>
                                    Nível {preset.level}: {preset.description}
                                </div>
                                <div style={{ fontSize: '9px', color: '#888' }}>
                                    JPEG {preset.jpegQuality}% • {preset.targetBitrate} Mbps
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Adaptive Toggle */}
                    <button
                        onClick={onEnableAdaptive}
                        disabled={isAdaptive && !isManual}
                        style={{
                            width: '100%',
                            padding: '10px',
                            background: isAdaptive && !isManual
                                ? 'rgba(46, 204, 113, 0.2)'
                                : 'rgba(52, 152, 219, 0.2)',
                            border: '1px solid',
                            borderColor: isAdaptive && !isManual ? '#2ECC71' : '#3498DB',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: isAdaptive && !isManual ? 'not-allowed' : 'pointer',
                            opacity: isAdaptive && !isManual ? 0.6 : 1,
                            transition: 'all 0.2s'
                        }}
                    >
                        {isAdaptive && !isManual ? '✓ Modo Adaptativo Ativo' : '🔄 Ativar Modo Adaptativo'}
                    </button>

                    {/* Info Footer */}
                    <div style={{ marginTop: '12px', fontSize: '9px', color: '#666', textAlign: 'center', lineHeight: 1.4 }}>
                        O modo adaptativo ajusta automaticamente a qualidade com base nas condições da rede
                    </div>
                </div>
            )}
        </div>
    );
}
