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

    // Chat Multi-window
    openChatWindow: (sessionId: string, remoteId: string) => Promise<void>;
    notifyChatMessageReceived: (sessionId: string, message: any) => Promise<void>;
    onChatMessageReceived: (callback: (message: any) => void) => () => void;
    sendChatMessageFromWindow: (sessionId: string, message: any) => Promise<void>;
    onChatMessageOutgoing: (callback: (sessionId: string, message: any) => void) => () => void;

    // Debug Window
    openDebugWindow: () => Promise<void>;
    notifyDebugEvent: (event: any) => Promise<void>;
    onDebugEvent: (callback: (event: any) => void) => () => void;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
