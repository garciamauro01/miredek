import { useState, useEffect, useRef } from 'react';

export function useNativeScreenCapture() {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isActive, setIsActive] = useState(false);
    const isActiveRef = useRef(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationRef = useRef<number>(0);

    const startNativeCapture = async (monitorId: number = -1) => {
        try {
            console.log(`[NativeCapture] Iniciando captura nativa (MJPEG) para monitor ${monitorId}...`);

            // Stop existing if any
            if (isActiveRef.current) {
                stopNativeCapture();
            }

            const canvas = document.createElement('canvas');
            canvas.width = window.screen.width;
            canvas.height = window.screen.height;
            canvasRef.current = canvas;

            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error('Failed to get canvas context');

            // Create stream from canvas
            const canvasStream = canvas.captureStream(25); // Lowered slightly to 25fps for stability
            setStream(canvasStream);
            setIsActive(true);
            isActiveRef.current = true;

            // Using hidden image to decode MJPEG stream
            const img = new Image();
            img.crossOrigin = "Anonymous";

            const loop = () => {
                if (!canvasRef.current || !isActiveRef.current) {
                    return;
                }

                // Draw the current frame of the MJPEG stream to canvas
                if (img.naturalWidth > 0) {
                    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
                        console.log(`[NativeCapture] Canvas resized: ${img.naturalWidth}x${img.naturalHeight}`);
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                    }
                    ctx.drawImage(img, 0, 0);
                }

                if (document.hidden) {
                    animationRef.current = window.setTimeout(loop, 40) as any;
                } else {
                    animationRef.current = requestAnimationFrame(loop);
                }
            };

            img.onload = () => {
                // We don't call loop here to avoid multiple concurrent loops
                if (isActiveRef.current) {
                    // console.log('[NativeCapture] MJPEG Frame loaded');
                }
            };

            img.onerror = (e) => {
                console.error('[NativeCapture] MJPEG Stream Error:', e);
                // The browser usually retries MJPEG naturally, but we can nudge it
                if (isActiveRef.current) {
                    // No-op for now as re-calling startNativeCapture might be too heavy
                }
            };

            // The browser will continuously update this img object as the stream flows
            const url = `http://localhost:9876/stream.mjpeg?monitor=${monitorId}&t=${Date.now()}`;
            console.log('[NativeCapture] Setting img.src to:', url);
            img.src = url;

            // Start the loop ONCE
            loop();

        } catch (err) {
            console.error('[NativeCapture] Erro ao iniciar:', err);
            stopNativeCapture();
        }
    };

    const stopNativeCapture = () => {
        setIsActive(false);
        isActiveRef.current = false;
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            clearTimeout(animationRef.current);
            animationRef.current = 0;
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
