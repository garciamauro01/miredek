export interface ElectronAPI {
    getSources: () => Promise<any[]>;
    executeInput: (data: any) => Promise<void>;
    getAutostartStatus: () => Promise<boolean>;
    setAutostart: (value: boolean) => Promise<boolean>;
    showWindow: () => Promise<void>;
    writeClipboard: (text: string) => Promise<void>;
    readClipboard: () => Promise<string>;
    readFileChunk: (path: string, start: number, size: number) => Promise<Uint8Array>;
    saveFileChunk: (transferId: string, chunk: Uint8Array) => Promise<void>;
    finalizeFile: (transferId: string, fileName: string, x?: number, y?: number) => Promise<string>;
    getFileInfo: (path: string) => Promise<{ name: string, size: number, path: string }>;
    getAppVersion: () => Promise<string>;
    writeLog: (text: string) => Promise<void>;
    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    downloadAndInstallUpdate: (url: string) => Promise<void>;
    isAppInstalled: () => Promise<boolean>;
    getLocalIp: () => Promise<string>;
    resetInput: () => Promise<void>;
    onUpdateProgress: (callback: (progress: number) => void) => () => void;
    openDevTools: () => Promise<void>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
