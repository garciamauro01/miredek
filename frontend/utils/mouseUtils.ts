export const getRelativeMousePos = (
    e: React.MouseEvent | React.TouchEvent,
    videoElement: HTMLVideoElement | null,
    viewMode: 'fit' | 'original' | 'stretch' = 'fit'
) => {
    const video = videoElement;
    if (!video) return null;

    // Se o vídeo ainda não carregou as dimensões, tenta usar as dimensões do elemento
    // mas loga para sabermos que a precisão pode ser afetada.
    if (video.videoWidth === 0) {
        if (video.clientWidth > 0) {
            console.log('[mouseUtils] videoWidth é 0, mas clientWidth > 0. Tentando fallback...');
        } else {
            // Silencioso se o elemento também estiver zerado (provavelmente oculto)
            return null;
        }
    }

    const rect = video.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
        if (e.touches.length === 0) {
            console.warn('[mouseUtils] Toque vazio');
            return null;
        }
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const cw = video.clientWidth;
    const ch = video.clientHeight;
    // Fallback para dimensões do componente se o stream não estiver pronto
    const vw = video.videoWidth || cw || 1;
    const vh = video.videoHeight || ch || 1;

    let finalX = 0;
    let finalY = 0;
    let actualWidth = cw, actualHeight = ch, offsetX = 0, offsetY = 0;

    if (viewMode === 'stretch' || (video.videoWidth === 0 && viewMode === 'fit')) {
        // Se não temos as dimensões do vídeo, usamos o elemento todo
        finalX = x / cw;
        finalY = y / ch;
    } else if (viewMode === 'original') {
        finalX = x / cw;
        finalY = y / ch;
    } else {
        // Modo Fit (contain)
        const videoRatio = vw / vh;
        const elementRatio = cw / ch;

        // let actualWidth = cw, actualHeight = ch, offsetX = 0, offsetY = 0; // This line is now redundant and removed

        if (elementRatio > videoRatio) {
            // Pillarbox
            actualHeight = ch;
            actualWidth = actualHeight * videoRatio;
            offsetX = (cw - actualWidth) / 2;
            offsetY = 0;
        } else {
            // Letterbox
            actualWidth = cw;
            actualHeight = actualWidth / videoRatio;
            offsetX = 0;
            offsetY = (ch - actualHeight) / 2;
        }

        finalX = (x - offsetX) / actualWidth;
        finalY = (y - offsetY) / actualHeight;
    }

    const epsilon = 0.001;
    if (finalX < -epsilon || finalX > 1 + epsilon || finalY < -epsilon || finalY > 1 + epsilon) {
        // Log apenas se estiver muito longe de ser um arredondamento (ex: movimentando fora da janela)
        // Se estiver perto, clampamos
        if (finalX >= -epsilon && finalX <= 1 + epsilon && finalY >= -epsilon && finalY <= 1 + epsilon) {
            finalX = Math.max(0, Math.min(1, finalX));
            finalY = Math.max(0, Math.min(1, finalY));
        } else {
            // Se falhou e está razoavelmente perto do vídeo, loga para debug
            if (finalX > -0.2 && finalX < 1.2 && finalY > -0.2 && finalY < 1.2) {
                console.log(`[mouseUtils] Fora dos limites: finalX=${finalX.toFixed(3)}, finalY=${finalY.toFixed(3)} (videoWidth=${video.videoWidth}, cw=${cw}, offsetX=${(offsetX || 0).toFixed(0)})`);
            }
            return null;
        }
    }

    // Clamp final para garantir [0, 1]
    finalX = Math.max(0, Math.min(1, finalX));
    finalY = Math.max(0, Math.min(1, finalY));

    return { x: finalX, y: finalY };
};
