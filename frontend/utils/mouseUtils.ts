export const getRelativeMousePos = (
    e: React.MouseEvent | React.TouchEvent,
    videoElement: HTMLVideoElement | null,
    viewMode: 'fit' | 'original' | 'stretch' = 'fit'
) => {
    const video = videoElement;
    if (!video || video.videoWidth === 0) return null;

    const rect = video.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
        if (e.touches.length === 0) return null;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    let finalX = 0;
    let finalY = 0;

    const cw = video.clientWidth;
    const ch = video.clientHeight;
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if (viewMode === 'stretch') {
        finalX = x / cw;
        finalY = y / ch;
    } else if (viewMode === 'original') {
        finalX = x / cw;
        finalY = y / ch;
    } else {
        // Modo Fit (contain)
        const videoRatio = vw / vh;
        const elementRatio = cw / ch;

        let actualWidth, actualHeight, offsetX, offsetY;

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

    if (finalX < 0 || finalX > 1 || finalY < 0 || finalY > 1) return null;
    return { x: finalX, y: finalY };
};
