import { useState, useEffect, useRef } from 'react';

export function useNativeScreenCapture() {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isActive, setIsActive] = useState(false);
    const isActiveRef = useRef(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationRef = useRef<number>(0);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const lastFrameTimeRef = useRef<number>(0);
    const stallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentMonitorIdRef = useRef<number>(-1);

    const clearTimers = () => {
        if (stallTimerRef.current) { clearInterval(stallTimerRef.current); stallTimerRef.current = null; }
        if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    };

    const connectStream = () => {
        if (!isActiveRef.current) return;
        const url = `http://localhost:9876/stream.mjpeg?monitor=${currentMonitorIdRef.current}&t=${Date.now()}`;
        console.log('[NativeCapture] Conectando stream MJPEG:', url);
        if (imgRef.current) {
            imgRef.current.src = url;
        }
        lastFrameTimeRef.current = Date.now();
    };

    const startNativeCapture = async (monitorId: number = -1) => {
        try {
            console.log(`[NativeCapture] Iniciando captura nativa (MJPEG) para monitor ${monitorId}...`);

            // Stop existing if any
            if (isActiveRef.current) {
                stopNativeCapture();
            }

            currentMonitorIdRef.current = monitorId;

            const canvas = document.createElement('canvas');
            canvas.width = window.screen.width;
            canvas.height = window.screen.height;
            canvasRef.current = canvas;

            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error('Failed to get canvas context');

            // Create stream from canvas
            const canvasStream = canvas.captureStream(25);
            setStream(canvasStream);
            setIsActive(true);
            isActiveRef.current = true;
            lastFrameTimeRef.current = Date.now();

            // Create img element and store in ref
            const img = new Image();
            img.crossOrigin = "Anonymous";
            imgRef.current = img;

            img.onerror = (e) => {
                console.warn('[NativeCapture] MJPEG Stream Error, reconectando em 2s...', e);
                if (isActiveRef.current) {
                    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
                    reconnectTimerRef.current = setTimeout(connectStream, 2000);
                }
            };

            // Animation loop — always draws from imgRef.current
            const loop = () => {
                if (!canvasRef.current || !isActiveRef.current) return;

                const currentImg = imgRef.current;
                if (currentImg && currentImg.naturalWidth > 0) {
                    if (canvas.width !== currentImg.naturalWidth || canvas.height !== currentImg.naturalHeight) {
                        console.log(`[NativeCapture] Canvas resized: ${currentImg.naturalWidth}x${currentImg.naturalHeight}`);
                        canvas.width = currentImg.naturalWidth;
                        canvas.height = currentImg.naturalHeight;
                    }
                    ctx.drawImage(currentImg, 0, 0);
                    lastFrameTimeRef.current = Date.now();
                }

                if (document.hidden) {
                    animationRef.current = window.setTimeout(loop, 40) as any;
                } else {
                    animationRef.current = requestAnimationFrame(loop);
                }
            };

            // Stall detection: if no new frame for 8s, reconnect (only once per stall)
            stallTimerRef.current = setInterval(() => {
                if (!isActiveRef.current) return;
                const elapsed = Date.now() - lastFrameTimeRef.current;
                if (elapsed > 8000) {
                    console.warn(`[NativeCapture] Stream travado há ${elapsed}ms, reconectando...`);
                    lastFrameTimeRef.current = Date.now(); // Reset immediately to prevent loop
                    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
                    reconnectTimerRef.current = setTimeout(connectStream, 200);
                }
            }, 3000);

            connectStream();
            loop();

        } catch (err) {
            console.error('[NativeCapture] Erro ao iniciar:', err);
            stopNativeCapture();
        }
    };

    const stopNativeCapture = () => {
        setIsActive(false);
        isActiveRef.current = false;
        clearTimers();
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            clearTimeout(animationRef.current);
            animationRef.current = 0;
        }
        if (imgRef.current) {
            imgRef.current.src = '';
            imgRef.current = null;
        }
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            setStream(null);
        }
        canvasRef.current = null;
    };

    useEffect(() => {
        return () => {
            stopNativeCapture();
        };
    }, []);

    return {
        nativeStream: stream,
        isNativeActive: isActive,
        startNativeCapture,
        stopNativeCapture
    };
}
