import { useState, useEffect, useRef, useCallback } from 'react';

export interface NetworkMetrics {
    rtt: number;              // Round Trip Time (ms)
    packetLoss: number;       // Packet loss rate (0-1)
    bitrate: number;          // Current bitrate (bps)
    jitter: number;           // Jitter (ms)
    timestamp: number;
}

export interface QualityLevel {
    level: number;            // 1-5 (1=lowest, 5=highest)
    jpegQuality: number;      // 10-100
    blockSize: number;        // 32, 64, 128
    targetBitrate: number;    // Target bitrate (Mbps)
    description: string;
}

// Quality presets based on network conditions
const QUALITY_PRESETS: QualityLevel[] = [
    {
        level: 1,
        jpegQuality: 30,
        blockSize: 128,
        targetBitrate: 0.5,
        description: 'Baixa (Poupança de dados)'
    },
    {
        level: 2,
        jpegQuality: 50,
        blockSize: 96,
        targetBitrate: 1.0,
        description: 'Média-Baixa'
    },
    {
        level: 3,
        jpegQuality: 65,
        blockSize: 64,
        targetBitrate: 2.0,
        description: 'Média (Padrão)'
    },
    {
        level: 4,
        jpegQuality: 80,
        blockSize: 64,
        targetBitrate: 4.0,
        description: 'Alta'
    },
    {
        level: 5,
        jpegQuality: 95,
        blockSize: 48,
        targetBitrate: 8.0,
        description: 'Máxima (Sem compressão)'
    }
];

export function useNetworkQuality(peerConnection: RTCPeerConnection | null) {
    const [metrics, setMetrics] = useState<NetworkMetrics>({
        rtt: 0,
        packetLoss: 0,
        bitrate: 0,
        jitter: 0,
        timestamp: Date.now()
    });

    const [currentQuality, setCurrentQuality] = useState<QualityLevel>(QUALITY_PRESETS[2]); // Start at medium
    const [isAdaptive, setIsAdaptive] = useState(true);
    const [isManual, setIsManual] = useState(false);

    const lastStatsRef = useRef<RTCStatsReport | null>(null);
    const lastBytesReceived = useRef(0);
    const lastTimestamp = useRef(Date.now());
    const qualityHistoryRef = useRef<number[]>([]);

    // Measure network metrics from WebRTC stats
    const measureNetworkMetrics = useCallback(async () => {
        if (!peerConnection) return;

        try {
            const stats = await peerConnection.getStats();
            let newMetrics: Partial<NetworkMetrics> = {};
            let foundInbound = false;

            stats.forEach((report) => {
                // Inbound RTP (video received)
                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                    foundInbound = true;

                    // RTT from candidate-pair
                    if (report.roundTripTime !== undefined) {
                        newMetrics.rtt = report.roundTripTime * 1000; // Convert to ms
                    }

                    // Packet loss
                    if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                        const totalPackets = report.packetsLost + report.packetsReceived;
                        newMetrics.packetLoss = totalPackets > 0 ? report.packetsLost / totalPackets : 0;
                    }

                    // Jitter
                    if (report.jitter !== undefined) {
                        newMetrics.jitter = report.jitter * 1000; // Convert to ms
                    }

                    // Bitrate calculation
                    const now = Date.now();
                    const timeDelta = (now - lastTimestamp.current) / 1000; // seconds

                    if (report.bytesReceived !== undefined && timeDelta > 0) {
                        const bytesDelta = report.bytesReceived - lastBytesReceived.current;
                        newMetrics.bitrate = (bytesDelta * 8) / timeDelta; // bits per second
                        lastBytesReceived.current = report.bytesReceived;
                    }

                    lastTimestamp.current = now;
                }

                // Candidate pair for RTT
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    if (report.currentRoundTripTime !== undefined) {
                        newMetrics.rtt = report.currentRoundTripTime * 1000;
                    }
                }
            });

            if (foundInbound && Object.keys(newMetrics).length > 0) {
                setMetrics(prev => ({
                    ...prev,
                    ...newMetrics,
                    timestamp: Date.now()
                }));
            }

            lastStatsRef.current = stats;
        } catch (err) {
            console.error('[NetworkQuality] Error measuring metrics:', err);
        }
    }, [peerConnection]);

    // Calculate optimal quality based on metrics
    const calculateOptimalQuality = useCallback((m: NetworkMetrics): QualityLevel => {
        // Score based on network conditions (0-100)
        let score = 100;

        // RTT penalty (0-50ms: 0 penalty, 50-200ms: moderate, >200ms: severe)
        if (m.rtt > 50) {
            score -= Math.min(40, (m.rtt - 50) / 5);
        }

        // Packet loss penalty (0-1%: minor, 1-5%: moderate, >5%: severe)
        if (m.packetLoss > 0.01) {
            score -= Math.min(40, m.packetLoss * 4000);
        }

        // Jitter penalty (0-30ms: 0 penalty, >30ms: moderate)
        if (m.jitter > 30) {
            score -= Math.min(20, (m.jitter - 30) / 2);
        }

        // Map score to quality level (with hysteresis)
        let targetLevel: number;
        if (score >= 90) targetLevel = 5;       // Excellent
        else if (score >= 75) targetLevel = 4;  // Good
        else if (score >= 55) targetLevel = 3;  // Medium
        else if (score >= 35) targetLevel = 2;  // Low
        else targetLevel = 1;                    // Very low

        // Add to history for smoothing
        qualityHistoryRef.current.push(targetLevel);
        if (qualityHistoryRef.current.length > 5) {
            qualityHistoryRef.current.shift();
        }

        // Average last 5 measurements for stability
        const avgLevel = Math.round(
            qualityHistoryRef.current.reduce((a, b) => a + b, 0) / qualityHistoryRef.current.length
        );

        return QUALITY_PRESETS[avgLevel - 1];
    }, []);

    // Auto-adjust quality
    useEffect(() => {
        if (!isAdaptive || isManual || !peerConnection) return;

        const interval = setInterval(() => {
            measureNetworkMetrics();
        }, 2000); // Measure every 2 seconds

        return () => clearInterval(interval);
    }, [isAdaptive, isManual, peerConnection, measureNetworkMetrics]);

    // Apply optimal quality when metrics change
    useEffect(() => {
        if (!isAdaptive || isManual) return;

        // Only adjust if we have recent metrics
        if (Date.now() - metrics.timestamp > 5000) return;

        const optimalQuality = calculateOptimalQuality(metrics);

        // Only change if different (avoid thrashing)
        if (optimalQuality.level !== currentQuality.level) {
            console.log(
                `[NetworkQuality] Adjusting quality: ${currentQuality.level} → ${optimalQuality.level} ` +
                `(RTT: ${metrics.rtt.toFixed(0)}ms, Loss: ${(metrics.packetLoss * 100).toFixed(1)}%)`
            );
            setCurrentQuality(optimalQuality);
        }
    }, [metrics, isAdaptive, isManual, calculateOptimalQuality, currentQuality.level]);

    // Manual quality override
    const setManualQuality = useCallback((level: number) => {
        if (level < 1 || level > 5) return;
        setIsManual(true);
        setCurrentQuality(QUALITY_PRESETS[level - 1]);
    }, []);

    // Enable adaptive mode
    const enableAdaptive = useCallback(() => {
        setIsManual(false);
        setIsAdaptive(true);
        qualityHistoryRef.current = [];
    }, []);

    return {
        metrics,
        currentQuality,
        qualityPresets: QUALITY_PRESETS,
        isAdaptive,
        isManual,
        setManualQuality,
        enableAdaptive,
        measureNetworkMetrics
    };
}
