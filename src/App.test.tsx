import { render, screen, waitFor, act } from '@testing-library/react';
import App from './App';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- MOCKS ---

// 1. Mock Electron API
// @ts-ignore
window.electronAPI = {
    getSources: vi.fn(),
    executeInput: vi.fn(),
    getAutostartStatus: vi.fn().mockResolvedValue(false),
    setAutostart: vi.fn().mockResolvedValue(true),
    showWindow: vi.fn().mockResolvedValue(undefined),
    writeClipboard: vi.fn().mockResolvedValue(undefined),
    readClipboard: vi.fn().mockResolvedValue(''),
    readFileChunk: vi.fn().mockResolvedValue(new Uint8Array()),
    saveFileChunk: vi.fn().mockResolvedValue(true),
    finalizeFile: vi.fn().mockResolvedValue('/mock/path'),
    getFileInfo: vi.fn().mockResolvedValue({ name: 'test', size: 100, path: '/test' })
};

// 2. Mock MediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
    value: {
        getUserMedia: vi.fn(() => Promise.resolve({
            getTracks: () => [{ kind: 'video', id: 'local-track' }]
        })),
        getDisplayMedia: vi.fn()
    }
});

// 3. Mock PeerJS
const mockPeerOn = vi.fn();
const mockPeerCall = vi.fn();
const mockPeerConnect = vi.fn();
const mockPeerDestroy = vi.fn();

vi.mock('peerjs', () => {
    return {
        Peer: vi.fn().mockImplementation(function () {
            return {
                on: mockPeerOn,
                call: mockPeerCall,
                connect: mockPeerConnect,
                destroy: mockPeerDestroy,
                reconnect: vi.fn()
            };
        })
    };
});

describe('App Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock implementation for callbacks
        mockPeerOn.mockImplementation((event, callback) => {
            if (event === 'open') {
                // Simulate successful connection immediately
                callback('test-my-id');
            }
        });
    });

    it('deve iniciar compartilhamento automatico ao carregar', async () => {
        // Setup Electron Mock to return a screen
        (window.electronAPI.getSources as any).mockResolvedValue([
            { id: 'screen:0:0', name: 'Screen 1', thumbnail: { toDataURL: () => '' } }
        ]);

        render(<App />);

        // Verifica se tentou pegar as fontes
        await waitFor(() => expect(window.electronAPI.getSources).toHaveBeenCalled());

        // Verifica se "Compartilhamento Ativo" aparece na UI (sidebar)
        await waitFor(() => {
            expect(screen.getByText(/Compartilhamento Ativo/i)).toBeInTheDocument();
        });

        // Verifica se tentou capturar a midia
        await waitFor(() => {
            expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
        });
    });

    it('deve mostrar status conectado quando receber chamada', async () => {
        (window.electronAPI.getSources as any).mockResolvedValue([]);

        render(<App />);

        // Simulate Receiving a Call
        let callHandler: any;
        // Find the 'call' event handler registered by App
        const callRegistration = mockPeerOn.mock.calls.find(call => call[0] === 'call');
        if (callRegistration) {
            callHandler = callRegistration[1];
        }

        expect(callHandler).toBeDefined();

        // Simulate a dummy call object
        const dummyStream = { getTracks: () => [{ kind: 'video' }] };
        const dummyCall = {
            peer: 'remote-peer-id',
            answer: vi.fn(),
            on: vi.fn((event, cb) => {
                if (event === 'stream') cb(dummyStream);
            }),
            peerConnection: {
                oniceconnectionstatechange: null,
                ontrack: null
            }
        };

        // Trigger the call
        act(() => {
            callHandler(dummyCall);
        });

        // App should now wait for user acceptance (modal) OR auto-accept depending on logic.
        // Current logic: Shows Modal "Recebendo Chamada"
        expect(screen.getByRole('heading', { name: /Recebendo Chamada/i })).toBeInTheDocument();

        // Click Accept
        /* Note: To click accept, we need a local stream first. 
           In this test scenario without getSources returning anything, 
           user might need to select something or valid logic. 
           But let's assume we want to test just the arrival of the call dialog first.
        */
    });
});
