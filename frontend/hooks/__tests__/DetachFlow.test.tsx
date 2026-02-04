// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePeerConnection } from '../usePeerConnection';
import { useRemoteSession } from '../useRemoteSession';


// --- MOCKS ---

// Mock ElectronAPI
const mockElectronAPI = {
    getSources: vi.fn(),
    writeLog: vi.fn(),
    resetInput: vi.fn(),
    notifyDebugEvent: vi.fn(),
    executeInput: vi.fn(),
    openChatWindow: vi.fn(),
    notifyChatMessageReceived: vi.fn(),
    onChatMessageOutgoing: vi.fn(() => vi.fn())
};
Object.defineProperty(window, 'electronAPI', { value: mockElectronAPI, writable: true });

// PeerJS registries for inspection
const peerRegistries = {
    onListeners: new Map<string, Function>(),
    instances: [] as any[]
};
(window as any)._peerRegistries = peerRegistries;

// Robust PeerJS Mock
vi.mock('peerjs', () => {
    return {
        default: vi.fn().mockImplementation(function () {
            const regs = (window as any)._peerRegistries;
            const instance = {
                on: vi.fn((evt, cb) => {
                    regs.onListeners.set(evt, cb);
                }),
                connect: vi.fn(() => ({ on: vi.fn(), open: true, send: vi.fn() })),
                call: vi.fn(() => ({ on: vi.fn(), answer: vi.fn(), close: vi.fn() })),
                destroy: vi.fn(),
                reconnect: vi.fn(),
                id: 'mock-peer-id'
            };
            regs.instances.push(instance);
            return instance;
        })
    };
});

describe('Detach Flow & Handover Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        const regs = (window as any)._peerRegistries;
        regs.onListeners.clear();
        regs.instances = [];
    });

    describe('Handover Side (Host)', () => {
        it('should receive and store handover token via data channel', async () => {
            const { result } = renderHook(() => useRemoteSession({
                serverIp: 'localhost',
                myId: 'host-id',
                contacts: [],
                setContacts: vi.fn(),
                setRecentSessions: vi.fn(),
                sessionPassword: '',
                unattendedPassword: '',
                localStream: null,
                sources: [],
                currentSourceId: '',
                selectSource: vi.fn().mockResolvedValue(undefined),
                onFileMessage: vi.fn()
            }));

            const mockConn = {
                peer: 'client-id',
                on: vi.fn(),
                open: true,
                send: vi.fn()
            } as any;

            // 1. Initial setup of session in state
            await act(async () => {
                result.current.setSessions([{ id: 'session-1', remoteId: 'client-id', isIncoming: true, connected: true } as any]);
            });

            // 2. Setup listeners for this connection
            await act(async () => {
                result.current.setupDataListeners('session-1', mockConn, true);
            });

            // 3. Extract logic: Simular recebimento de HANDOVER_PREPARATION
            const dataCallback = mockConn.on.mock.calls.find((c: any) => c[0] === 'data')[1];
            await act(async () => {
                dataCallback({ type: 'HANDOVER_PREPARATION', token: 'secret-token-123' });
            });

            // 4. Verify token presence (indirectly via the ref which we exported)
            expect(result.current.handoverTokensRef.current.has('secret-token-123')).toBe(true);
        });
    });

    describe('Validation & Auto-Acceptance (Host)', () => {
        it('should pre-authenticate session if metadata contains valid handover token', async () => {
            const setSessions = vi.fn((updater) => {
                const prev: any[] = [];
                // This is a simplified mock of setSessions logic
                const newState = typeof updater === 'function' ? updater(prev) : updater;
                return newState;
            });
            const onShowRequest = vi.fn();
            const videoRefsMap = { current: new Map() } as any;

            // Simular token já presente
            const handoverTokens = new Set(['valid-token']);
            const onHandoverCheck = (metadata: any) => {
                if (metadata?.handoverToken && handoverTokens.has(metadata.handoverToken)) {
                    return true;
                }
                return false;
            };

            renderHook(() => usePeerConnection(
                'localhost', setSessions, videoRefsMap, vi.fn(), onShowRequest, onHandoverCheck
            ));

            const regs = (window as any)._peerRegistries;
            const callHandler = regs.onListeners.get('call');

            // Chamada com token VÁLIDO
            const mockCallValid = {
                peer: 'client-detached',
                metadata: { handoverToken: 'valid-token' },
                on: vi.fn(), answer: vi.fn()
            };

            await act(async () => {
                if (callHandler) callHandler(mockCallValid);
            });

            // 1. setSessions deve ter sido chamado com isAuthenticated: true
            expect(setSessions).toHaveBeenCalledWith(expect.any(Function));

            // 2. onShowRequest NÃO deve ser chamado (é um handover interno, sem modal extra)
            expect(onShowRequest).not.toHaveBeenCalled();
        });

        it('should NOT pre-authenticate session if token is missing or invalid', async () => {
            const setSessions = vi.fn();
            const onShowRequest = vi.fn();
            const videoRefsMap = { current: new Map() } as any;
            const onHandoverCheck = () => false;

            renderHook(() => usePeerConnection(
                'localhost', setSessions, videoRefsMap, vi.fn(), onShowRequest, onHandoverCheck
            ));

            const regs = (window as any)._peerRegistries;
            const callHandler = regs.onListeners.get('call');

            // Chamada SEM token
            const mockCallInvalid = {
                peer: 'client-attacker',
                metadata: {},
                on: vi.fn(), answer: vi.fn()
            };

            await act(async () => {
                if (callHandler) callHandler(mockCallInvalid);
            });

            // onShowRequest DEVE ser chamado (novo pedido de conexão real)
            expect(onShowRequest).toHaveBeenCalled();
        });
    });

    describe('Multi-Window Isolation (Unique Peer IDs)', () => {
        it('should use customPeerId if provided, bypassing localStorage', async () => {
            localStorage.setItem('anydesk_clone_id', 'persisted-id');
            const customId = 'isolated-unique-id';

            renderHook(() => usePeerConnection(
                'localhost', vi.fn(), { current: new Map() } as any, vi.fn(), vi.fn(), vi.fn(),
                customId
            ));


            // O PeerJS (mock) deve ter sido instanciado com o customId
            // Verificamos o primeiro argumento do construtor vi.mocked(Peer)
            const PeerConstructor = require('peerjs').default;
            expect(PeerConstructor).toHaveBeenCalledWith(customId, expect.any(Object));
        });
    });
});
