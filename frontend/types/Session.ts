import Peer from 'peerjs';

export interface Session {
    id: string;
    remoteId: string;
    connected: boolean;
    isConnecting: boolean;
    peer: Peer | null;
    remoteStream: MediaStream | null;
    dataConnection: any;
    logs: string[];
    incomingCall: any;
    isIncoming: boolean;
    remoteSources?: any[];
    activeSourceId?: string;
    isAuthenticated?: boolean;
    isAuthenticating?: boolean;
    viewMode?: 'fit' | 'original' | 'stretch';
    shouldRememberPassword?: boolean;
    pendingPassword?: string;
    messages?: { sender: 'me' | 'remote', text: string, timestamp: number }[];
    isChatOpen?: boolean;
    hasNewMessage?: boolean;
    status?: 'connected' | 'disconnected' | 'reconnecting';
    lastHeartbeat?: number;
    authError?: string;
}

export function createSession(id: string, remoteId: string = '', isIncoming: boolean = false): Session {
    return {
        id,
        remoteId,
        connected: false,
        isConnecting: false,
        peer: null,
        remoteStream: null,
        dataConnection: null,
        logs: [],
        incomingCall: null,
        isIncoming,
        remoteSources: [],
        viewMode: 'fit',
        isAuthenticating: false,
        messages: [],
        isChatOpen: false,
        hasNewMessage: false,
        status: isIncoming ? 'connected' : 'disconnected'
    };
}
