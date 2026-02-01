import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    getSources: () => ipcRenderer.invoke('get-sources'),
    executeInput: (data: any) => ipcRenderer.invoke('execute-input', data),
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
    openDevTools: () => ipcRenderer.invoke('open-devtools')
});
