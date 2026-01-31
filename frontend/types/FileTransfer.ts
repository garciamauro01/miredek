export interface FileTransferState {
    id: string;
    name: string;
    size: number;
    received: number;
    status: 'sending' | 'receiving' | 'completed' | 'error';
    progress: number;
}
