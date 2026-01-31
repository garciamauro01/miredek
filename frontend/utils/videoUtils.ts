export const captureSnapshot = (video: HTMLVideoElement): string | null => {
    if (video.videoWidth === 0) return null;

    try {
        const canvas = document.createElement('canvas');
        const scale = 320 / video.videoWidth;
        canvas.width = 320;
        canvas.height = video.videoHeight * scale;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', 0.7);
        }
    } catch (e) {
        console.error('Erro ao capturar snapshot:', e);
    }
    return null;
};
