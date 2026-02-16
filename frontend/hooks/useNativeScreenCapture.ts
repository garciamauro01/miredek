import { useState, useEffect, useRef } from 'react';

export function useNativeScreenCapture() {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isActive, setIsActive] = useState(false);
    const isActiveRef = useRef(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationRef = useRef<number>(0);

    const imgRef = useRef<HTMLImageElement | null>(null);
    const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

    const startNativeCapture = async (monitorId: number = -1, mode: 'mjpeg' | 'differential' = 'differential') => {
        try {
            console.log(`[NativeCapture] Iniciando captura nativa (${mode.toUpperCase()}) para monitor ${monitorId}...`);

            // Stop existing if any
            stopNativeCapture();

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

            if (mode === 'differential') {
                // Differential Block Protocol Mode
                console.log('[NativeCapture] Starting differential block stream...');

                const url = `http://localhost:9876/stream.blocks?monitor=${monitorId}&t=${Date.now()}`;
                const response = await fetch(url);

                if (!response.ok || !response.body) {
                    throw new Error('Failed to start block stream');
                }

                const reader = response.body.getReader();
                readerRef.current = reader;

                let buffer = new Uint8Array(0);
                let frameCount = 0;

                const processStream = async () => {
                    try {
                        while (isActiveRef.current) {
                            const { done, value } = await reader.read();

                            if (done) {
                                console.log('[NativeCapture] Block stream ended');
                                break;
                            }

                            // Append new data to buffer
                            const newBuffer = new Uint8Array(buffer.length + value.length);
                            newBuffer.set(buffer);
                            newBuffer.set(value, buffer.length);
                            buffer = newBuffer;

                            // Try to parse frames from buffer
                            while (buffer.length >= 12) { // Minimum header size
                                // Check magic header "BLCK"
                                if (buffer[0] !== 0x42 || buffer[1] !== 0x4C ||
                                    buffer[2] !== 0x43 || buffer[3] !== 0x4B) {
                                    console.error('[NativeCapture] Invalid magic header');
                                    buffer = buffer.slice(1); // Skip byte and retry
                                    continue;
                                }

                                // Parse frame header
                                const view = new DataView(buffer.buffer, buffer.byteOffset);
                                // frameNumber = view.getUint32(4, true); // Little-endian (not used yet)
                                const blockCount = view.getUint16(8, true);
                                // flags = view.getUint16(10, true); // Reserved for future use

                                // Calculate required buffer size
                                let offset = 12;
                                let requiredSize = 12;

                                for (let i = 0; i < blockCount; i++) {
                                    if (buffer.length < offset + 8) {
                                        // Not enough data yet
                                        break;
                                    }
                                    const blockDataSize = view.getUint32(offset + 4, true);
                                    requiredSize = offset + 8 + blockDataSize;
                                    offset += 8 + blockDataSize;
                                }

                                if (buffer.length < requiredSize) {
                                    // Wait for more data
                                    break;
                                }

                                // Parse and render blocks
                                offset = 12;
                                for (let i = 0; i < blockCount; i++) {
                                    const blockX = view.getUint16(offset, true);
                                    const blockY = view.getUint16(offset + 2, true);
                                    const blockDataSize = view.getUint32(offset + 4, true);
                                    offset += 8;

                                    // Extract JPEG data
                                    const jpegData = buffer.slice(offset, offset + blockDataSize);
                                    offset += blockDataSize;

                                    // Decode and draw block
                                    const blob = new Blob([jpegData], { type: 'image/jpeg' });
                                    const imgUrl = URL.createObjectURL(blob);

                                    const blockImg = new Image();
                                    blockImg.onload = () => {
                                        if (canvasRef.current) {
                                            const ctx = canvasRef.current.getContext('2d');
                                            if (ctx) {
                                                ctx.drawImage(blockImg, blockX * 64, blockY * 64);
                                            }
                                        }
                                        URL.revokeObjectURL(imgUrl);
                                    };
                                    blockImg.src = imgUrl;
                                }

                                frameCount++;
                                if (frameCount % 30 === 0) {
                                    console.log(`[NativeCapture] Processed ${frameCount} differential frames (${blockCount} blocks in last)`);
                                }

                                // Remove processed frame from buffer
                                buffer = buffer.slice(requiredSize);
                            }
                        }
                    } catch (err) {
                        console.error('[NativeCapture] Block stream error:', err);
                    }
                };

                processStream();

            } else {
                // Original MJPEG Mode
                const img = new Image();
                img.crossOrigin = "Anonymous";
                imgRef.current = img;

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
                    if (isActiveRef.current) {
                        // console.log('[NativeCapture] MJPEG Frame loaded');
                    }
                };

                img.onerror = (e) => {
                    console.error('[NativeCapture] MJPEG Stream Error:', e);
                };

                const url = `http://localhost:9876/stream.mjpeg?monitor=${monitorId}&t=${Date.now()}`;
                console.log('[NativeCapture] Setting img.src to:', url);
                img.src = url;

                loop();
            }

        } catch (err) {
            console.error('[NativeCapture] Erro ao iniciar:', err);
            stopNativeCapture();
        }
    };

    const stopNativeCapture = () => {
        setIsActive(false);
        isActiveRef.current = false;

        if (readerRef.current) {
            console.log('[NativeCapture] Canceling block stream reader...');
            readerRef.current.cancel();
            readerRef.current = null;
        }

        if (imgRef.current) {
            console.log('[NativeCapture] Limpando src da imagem anterior...');
            imgRef.current.src = ''; // Cancela a requisição pendente
            imgRef.current = null;
        }

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
