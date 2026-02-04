import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    getSources: () => ipcRenderer.invoke('get-sources'),
    executeInput: (data: any) => ipcRenderer.send('execute-input', data),
    getAutostartStatus: () => ipcRenderer.invoke('get-autostart-status'),
    setAutostart: (value: boolean) => ipcRenderer.invoke('set-autostart', value),
    showWindow: () => ipcRenderer.invoke('show-window'),
    writeClipboard: (text: string) => ipcRenderer.invoke('write-clipboard', text),
    readClipboard: () => ipcRenderer.invoke('read-clipboard'),
    readFileChunk: (path: string, start: number, size: number) => ipcRenderer.invoke('read-file-chunk', path, start, size),
    saveFileChunk: (transferId: string, chunk: Uint8Array) => ipcRenderer.invoke('save-file-chunk', transferId, chunk),
    finalizeFile: (transferId: string, fileName: string, x?: number, y?: number) => ipcRenderer.invoke('finalize-file', transferId, fileName, x, y),
    getFileInfo: (path: string) => ipcRenderer.invoke('get-file-info', path),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    writeLog: (text: string) => ipcRenderer.invoke('write-log', text),
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),
    downloadAndInstallUpdate: (url: string) => ipcRenderer.invoke('download-and-install-update', url),
    isAppInstalled: () => ipcRenderer.invoke('is-app-installed'),
    getLocalIp: () => ipcRenderer.invoke('get-local-ip'),
    resetInput: () => ipcRenderer.invoke('reset-input'),
    onUpdateProgress: (callback: (progress: number) => void) => {
        const listener = (_event: any, progress: number) => callback(progress);
        ipcRenderer.on('update-progress', listener);
        return () => ipcRenderer.removeListener('update-progress', listener);
    },
    openDevTools: () => ipcRenderer.invoke('open-devtools'),
    openChatWindow: (sessionId: string, remoteId: string) => ipcRenderer.invoke('open-chat-window', sessionId, remoteId),
    notifyChatMessageReceived: (sessionId: string, message: any) => ipcRenderer.invoke('chat-notify-received', sessionId, message),
    onChatMessageReceived: (callback: (message: any) => void) => {
        const listener = (_event: any, message: any) => callback(message);
        ipcRenderer.on('chat-message-received', listener);
        return () => ipcRenderer.removeListener('chat-message-received', listener);
    },
    sendChatMessageFromWindow: (sessionId: string, message: any) => ipcRenderer.invoke('chat-send-from-window', sessionId, message),
    onChatMessageOutgoing: (callback: (sessionId: string, message: any) => void) => {
        const listener = (_event: any, sessionId: string, message: any) => callback(sessionId, message);
        ipcRenderer.on('chat-message-outgoing', listener);
        return () => ipcRenderer.removeListener('chat-message-outgoing', listener);
    },
    // --- DEBUG WINDOW ---
    openDebugWindow: () => ipcRenderer.invoke('open-debug-window'),
    notifyDebugEvent: (event: any) => ipcRenderer.invoke('debug-notify-event', event),
    onDebugEvent: (callback: (event: any) => void) => {
        const listener = (_event: any, eventData: any) => callback(eventData);
        ipcRenderer.on('debug-event-received', listener);
        return () => ipcRenderer.removeListener('debug-event-received', listener);
    }
});
