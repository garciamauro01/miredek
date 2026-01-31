// @vitest-environment jsdom
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
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
    getFileInfo: vi.fn().mockResolvedValue({ name: 'test', size: 100, path: '/test' }),
    getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
    onUpdateProgress: vi.fn().mockReturnValue(() => { }),
    openDevTools: vi.fn().mockResolvedValue(undefined),
    getLocalIp: vi.fn().mockResolvedValue('127.0.0.1'),
    writeLog: vi.fn().mockResolvedValue(undefined),
    downloadAndInstallUpdate: vi.fn().mockResolvedValue(true),
    isAppInstalled: vi.fn().mockResolvedValue(true),
};
window.alert = vi.fn();
window.confirm = vi.fn().mockReturnValue(true);

// 2. Mock MediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
    value: {
        getUserMedia: vi.fn(() => Promise.resolve({
            getTracks: () => [{ kind: 'video', id: 'local-track', stop: vi.fn() }],
            getVideoTracks: () => [{ kind: 'video', id: 'local-track', stop: vi.fn() }],
            getAudioTracks: () => []
        })),
        getDisplayMedia: vi.fn()
    }
});

// 3. Mock PeerJS logic
// Usamos globalThis para persistir as referências dos mocks entre hoisting
vi.hoisted(() => {
    (globalThis as any)._mockPeerOn = vi.fn();
    (globalThis as any)._mockPeerConnect = vi.fn().mockImplementation(() => {
        const dummyConn = {
            peer: 'remote-id',
            on: vi.fn(),
            send: vi.fn(),
            open: true,
            close: vi.fn()
        };
        (globalThis as any)._lastConnection = dummyConn;
        return dummyConn;
    });
});

vi.mock('peerjs', () => {
    function MockPeer(this: any) {
        this.on = (globalThis as any)._mockPeerOn;
        this.call = vi.fn().mockReturnValue({
            on: vi.fn(),
            answer: vi.fn(),
            close: vi.fn(),
            peerConnection: { oniceconnectionstatechange: null, ontrack: null }
        });
        this.connect = (globalThis as any)._mockPeerConnect;
        this.destroy = vi.fn();
        this.reconnect = vi.fn();
    }

    return {
        default: MockPeer,
        Peer: MockPeer
    };
});

const getMockPeerOn = () => (globalThis as any)._mockPeerOn;
const getLastConnection = () => (globalThis as any)._lastConnection;

describe('App Component Connection Lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        (globalThis as any)._lastConnection = null;
        getMockPeerOn().mockImplementation((event: string, callback: (...args: any[]) => void) => {
            if (event === 'open') callback('test-my-id');
        });
    });

    it('deve fechar o modal se a chamada for cancelada pelo parceiro (evento close)', async () => {
        (window.electronAPI.getSources as any).mockResolvedValue([]);
        render(<App />);

        const callHandler = getMockPeerOn().mock.calls.find((call: any[]) => call[0] === 'call')[1];
        const dummyCall = {
            peer: 'remote-id',
            answer: vi.fn(),
            on: vi.fn(),
            peerConnection: { oniceconnectionstatechange: null, ontrack: null }
        };

        await act(async () => { callHandler(dummyCall); });
        expect(screen.getByRole('heading', { name: /Pedido de Conexão/i })).toBeInTheDocument();

        // Simula evento 'close' no objeto call
        const closeHandler = (dummyCall.on as any).mock.calls.find((call: any[]) => call[0] === 'close')[1];
        await act(async () => { closeHandler(); });

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /Pedido de Conexão/i })).not.toBeInTheDocument();
        });
    });

    it('deve fechar o modal ao clicar em REJEITAR', async () => {
        (window.electronAPI.getSources as any).mockResolvedValue([]);
        render(<App />);

        const callHandler = getMockPeerOn().mock.calls.find((call: any[]) => call[0] === 'call')[1];
        const dummyCall = {
            peer: 'remote-id',
            answer: vi.fn(),
            on: vi.fn(),
            peerConnection: { oniceconnectionstatechange: null, ontrack: null }
        };
        await act(async () => { callHandler(dummyCall); });

        const rejectBtn = screen.getByRole('button', { name: /REJEITAR/i });
        await act(async () => { rejectBtn.click(); });

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /Pedido de Conexão/i })).not.toBeInTheDocument();
        });
    });

    it('deve fechar o modal se a conexão de rede (ICE) falhar', async () => {
        (window.electronAPI.getSources as any).mockResolvedValue([]);
        render(<App />);

        const callHandler = getMockPeerOn().mock.calls.find((call: any[]) => call[0] === 'call')[1];
        const dummyCall = {
            peer: 'remote-id',
            answer: vi.fn(),
            on: vi.fn(),
            peerConnection: { oniceconnectionstatechange: null, ontrack: null, iceConnectionState: 'connecting' }
        };
        await act(async () => { callHandler(dummyCall); });

        // Simula falha no ICE
        const icePC = dummyCall.peerConnection as any;
        icePC.iceConnectionState = 'failed';
        await act(async () => { icePC.oniceconnectionstatechange(); });

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /Pedido de Conexão/i })).not.toBeInTheDocument();
        });
    });

    it('deve fechar o modal de aceite se receber CALL_CANCELLED via dados (Host)', async () => {
        render(<App />);

        // 1. Host recebe conexão de dados
        const connHandler = getMockPeerOn().mock.calls.find((call: any[]) => call[0] === 'connection')[1];
        const dummyConn = {
            peer: 'remote-id',
            on: vi.fn(),
            send: vi.fn(),
            open: true
        };
        await act(async () => { connHandler(dummyConn); });

        // Espera a sessão ser registrada antes de enviar a chamada
        await waitFor(() => {
            // Apenas espera um ciclo de render para estabilizar o estado das sessões
        });

        // 2. Host recebe chamada de vídeo
        const callHandler = getMockPeerOn().mock.calls.find((call: any[]) => call[0] === 'call')[1];
        const dummyCall = {
            peer: 'remote-id',
            answer: vi.fn(),
            on: vi.fn(),
            close: vi.fn(),
            peerConnection: { oniceconnectionstatechange: null, ontrack: null }
        };
        await act(async () => { callHandler(dummyCall); });

        // Verifica se modal apareceu
        expect(screen.getByRole('heading', { name: /Pedido de Conexão/i })).toBeInTheDocument();

        // 3. Recebe sinal de cancelamento
        const dataHandler = (dummyConn.on as any).mock.calls.find((call: any[]) => call[0] === 'data')[1];
        await act(async () => {
            dataHandler({ type: 'CALL_CANCELLED' });
        });

        // Modal deve sumir
        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /Pedido de Conexão/i })).not.toBeInTheDocument();
        });
    });

    it('deve autenticar automaticamente e remover modal se a senha estiver correta (bypass)', async () => {
        (window.electronAPI.getSources as any).mockResolvedValue([
            { id: 'screen:0', name: 'Screen 0', isPrimary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }
        ]);

        render(<App />);

        // Descobre a senha que o App gerou via UI
        let generatedPassword = '';
        await waitFor(() => {
            const passEl = screen.getByTestId('session-password-input') as HTMLInputElement;
            generatedPassword = passEl.value;
            expect(generatedPassword).toBeTruthy();
            expect(generatedPassword).not.toBe('...');
        }, { timeout: 10000 });

        // 1. Simula conexão de dados (Host recebendo conexão)
        const connectionHandler = getMockPeerOn().mock.calls.find((call: any[]) => call[0] === 'connection')[1];
        const dummyConn = { peer: 'remote-id', on: vi.fn(), send: vi.fn(), open: true };
        await act(async () => { connectionHandler(dummyConn); });

        // 2. Simula chamada de vídeo
        const callHandler = getMockPeerOn().mock.calls.find((call: any[]) => call[0] === 'call')[1];
        const dummyCall = {
            peer: 'remote-id',
            answer: vi.fn(),
            on: vi.fn(),
            peerConnection: { oniceconnectionstatechange: null, ontrack: null }
        };
        await act(async () => { callHandler(dummyCall); });

        expect(screen.getByRole('heading', { name: /Pedido de Conexão/i })).toBeInTheDocument();

        // 3. Envia senha via AUTH
        const dataHandler = (dummyConn.on as any).mock.calls.find((call: any[]) => call[0] === 'data')[1];
        await act(async () => {
            dataHandler({ type: 'AUTH', password: generatedPassword });
        });

        // O modal deve ser removido pelo handleAnswerCall automático
        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /Pedido de Conexão/i })).not.toBeInTheDocument();
        }, { timeout: 15000 });
    }, 40000);

    it('deve alertar o cliente se o parceiro rejeitar a conexão (CALL_REJECTED)', async () => {
        (window.electronAPI.getSources as any).mockResolvedValue([
            { id: 'screen:0', name: 'Screen 0', isPrimary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }
        ]);

        render(<App />);

        // Espera a seleção automática de fonte terminar (que preenche localStreamRef.current)
        await waitFor(() => {
            expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
        });

        // Simula preenchimento do ID e clique em Conectar
        const idInput = screen.getByPlaceholderText(/ID da mesa remota/i);
        await act(async () => {
            fireEvent.change(idInput, { target: { value: 'remote-id' } });
        });

        const connectBtn = screen.getByRole('button', { name: /CONECTAR/i });
        await act(async () => { connectBtn.click(); });

        // O App chamou sessionManager.connectToRemote -> peer.connect.
        // Precisamos esperar o mock ser chamado e capturar a conexão
        let dummyConn: any = null;
        await waitFor(() => {
            dummyConn = getLastConnection();
            expect(dummyConn).toBeTruthy();
        });

        // Trigger 'open' para disparar o setupDataListeners no App
        const openHandler = (dummyConn.on as any).mock.calls.find((call: any[]) => call[0] === 'open')[1];
        await act(async () => { openHandler(); });

        // Agora o App registrou o handler de dados.
        // O App registra múltiplos listeners para 'data' (clipboard, files, auth).
        // Pegamos o que cuida da lógica principal.
        const dataHandlers = (dummyConn.on as any).mock.calls
            .filter((call: any[]) => call[0] === 'data')
            .map((call: any[]) => call[1]);

        if (dataHandlers.length === 0) throw new Error("Handler de dados não encontrado");

        // Em um cenário real de teste, os handlers são registrados em sequência.
        // Simulamos o recebimento em todos eles para garantir que o correto processe.
        await act(async () => {
            for (const handler of dataHandlers) {
                await handler({ type: 'CALL_REJECTED' });
            }
        });

        expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/rejeitada pelo parceiro/i));

        // Verifica se o modal de conexão foi removido
        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /Senha de Acesso/i })).not.toBeInTheDocument();
        });
    });
});
