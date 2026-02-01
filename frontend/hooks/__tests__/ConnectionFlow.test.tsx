// @vitest-environment jsdom
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePeerConnection } from '../usePeerConnection';
import { useRemoteSession } from '../useRemoteSession';
import { useDeviceSources } from '../useDeviceSources';

// --- MOCKS ---

// Mock ElectronAPI
const mockElectronAPI = {
    getSources: vi.fn(),
    writeClipboard: vi.fn(),
    executeInput: vi.fn(),
};
Object.defineProperty(window, 'electronAPI', { value: mockElectronAPI, writable: true });

// Attach registries to window so they are available in all modules even with hoisting/isolation issues
const peerRegistries = {
    onListeners: new Map<string, Function>(),
    connectCalls: [] as any[],
    callCalls: [] as any[],
    instances: [] as any[]
};
(window as any)._peerRegistries = peerRegistries;

// Mock MediaStream/MediaDevices
const mockStream = {
    id: 'mock-stream',
    getTracks: () => [{ stop: vi.fn() }],
    getVideoTracks: () => [{ stop: vi.fn() }]
};
const mockGetDisplayMedia = vi.fn().mockResolvedValue(mockStream);
const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

Object.defineProperty(navigator, 'mediaDevices', {
    value: {
        getDisplayMedia: mockGetDisplayMedia,
        getUserMedia: mockGetUserMedia
    },
    writable: true
});

// Clean and Robust PeerJS Mock
vi.mock('peerjs', () => {
    return {
        default: vi.fn().mockImplementation(function () {
            const regs = (window as any)._peerRegistries;
            const instance = {
                on: vi.fn((evt, cb) => {
                    regs.onListeners.set(evt, cb);
                }),
                connect: vi.fn((remoteId, options) => {
                    const conn = { on: vi.fn(), open: true, send: vi.fn() };
                    regs.connectCalls.push({ remoteId, options, conn }); // Store conn to inspect later
                    return conn;
                }),
                call: vi.fn((remoteId, stream, options) => {
                    regs.callCalls.push({ remoteId, stream, options });
                    return { on: vi.fn(), answer: vi.fn(), close: vi.fn() };
                }),
                destroy: vi.fn(),
                reconnect: vi.fn(),
                id: 'mock-peer-id'
            };
            regs.instances.push(instance);
            return instance;
        })
    };
});

describe('Connection Flow Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockElectronAPI.getSources.mockResolvedValue([{ id: 'screen1', name: 'Screen 1', thumbnail: '' }]);

        const regs = (window as any)._peerRegistries;
        regs.onListeners.clear();
        regs.connectCalls = [];
        regs.callCalls = [];
        regs.instances = [];
    });

    describe('1. Host Initialization (Auto-Source Selection)', () => {
        it('should auto-select the first available source on mount', async () => {
            const updateLocalStream = vi.fn();
            const onSourceChanged = vi.fn();

            renderHook(() => useDeviceSources(updateLocalStream, onSourceChanged));

            await waitFor(() => {
                expect(mockElectronAPI.getSources).toHaveBeenCalled();
                expect(onSourceChanged).toHaveBeenCalledWith('screen1');
                expect(updateLocalStream).toHaveBeenCalled();
            });
        });
    });

    describe('2. Client Initiation (Connect To)', () => {
        it('should initiate BOTH data connection and video call when connecting', async () => {
            const mockLocalStream = { id: 'local-stream', getTracks: () => [] } as any;

            const { result } = renderHook(() => useRemoteSession({
                serverIp: 'localhost',
                myId: 'client-id',
                contacts: [],
                setContacts: vi.fn(),
                setRecentSessions: vi.fn(),
                sessionPassword: '',
                unattendedPassword: '',
                localStream: mockLocalStream,
                sources: [],
                currentSourceId: '',
                onFileMessage: vi.fn()
            }));

            const regs = (window as any)._peerRegistries;

            // Trigger connection
            await act(async () => {
                result.current.connectTo('host-remote-id');
            });

            // 1. Peer instance should be created and 'open' listener registered
            await waitFor(() => {
                expect(regs.onListeners.has('open')).toBe(true);
            });

            // 2. Trigger 'open' event
            await act(async () => {
                const openHandler = regs.onListeners.get('open');
                if (openHandler) openHandler('some-id');
            });

            // 3. Verify BOTH connect and call were triggered
            await waitFor(() => {
                const call = regs.callCalls.find((c: any) => c.remoteId === 'host-remote-id');
                const conn = regs.connectCalls.find((c: any) => c.remoteId === 'host-remote-id');

                expect(call).toBeTruthy();
                expect(conn).toBeTruthy();
            });
        });
    });

    describe('3. Host Reception (Trigger Window Open)', () => {
        it('should call onShowRequest when receiving a DATA connection', async () => {
            const setSessions = vi.fn((updater) => {
                if (typeof updater === 'function') {
                    updater([]);
                }
            });
            const onShowRequest = vi.fn();
            const videoRefsMap = { current: new Map() } as any;
            const regs = (window as any)._peerRegistries;

            renderHook(() => usePeerConnection('localhost', setSessions, videoRefsMap, vi.fn(), onShowRequest));

            await waitFor(() => {
                expect(regs.onListeners.has('connection')).toBe(true);
            });

            const connHandler = regs.onListeners.get('connection');
            const mockConn = { peer: 'client-id', on: vi.fn(), open: true };

            await act(async () => {
                if (connHandler) connHandler(mockConn);
            });

            expect(onShowRequest).toHaveBeenCalled();
            expect(setSessions).toHaveBeenCalled();
        });

        it('should call onShowRequest when receiving a VIDEO call', async () => {
            const setSessions = vi.fn((updater) => {
                if (typeof updater === 'function') {
                    updater([]);
                }
            });
            const onShowRequest = vi.fn();
            const videoRefsMap = { current: new Map() } as any;
            const regs = (window as any)._peerRegistries;

            renderHook(() => usePeerConnection('localhost', setSessions, videoRefsMap, vi.fn(), onShowRequest));

            await waitFor(() => {
                expect(regs.onListeners.has('call')).toBe(true);
            });

            const callHandler = regs.onListeners.get('call');
            const mockCall = { peer: 'client-id', on: vi.fn(), answer: vi.fn() };

            await act(async () => {
                if (callHandler) callHandler(mockCall);
            });

            expect(onShowRequest).toHaveBeenCalled();
            expect(setSessions).toHaveBeenCalled();
        });
    });

    describe('4. Password Authentication', () => {
        it('should send AUTH message automatically when connecting if password is saved', async () => {
            const mockLocalStream = { id: 'local-stream', getTracks: () => [] } as any;
            const mockContact = { id: 'host-remote-id', savedPassword: 'secret-password', isFavorite: false };

            const { result } = renderHook(() => useRemoteSession({
                serverIp: 'localhost',
                myId: 'client-id',
                contacts: [mockContact],
                setContacts: vi.fn(),
                setRecentSessions: vi.fn(),
                sessionPassword: '',
                unattendedPassword: '',
                localStream: mockLocalStream,
                sources: [],
                currentSourceId: '',
                onFileMessage: vi.fn()
            }));

            const regs = (window as any)._peerRegistries;

            // Trigger connection
            await act(async () => {
                result.current.connectTo('host-remote-id');
            });

            // [FIX] Trigger 'open' event on the Peer created by sessionManager
            await waitFor(() => {
                expect(regs.onListeners.has('open')).toBe(true);
            });
            await act(async () => {
                const openHandler = regs.onListeners.get('open');
                if (openHandler) openHandler('mock-peer-id');
            });

            // Wait until data connection is created
            let connCall: any;
            await waitFor(() => {
                const call = regs.connectCalls.find((c: any) => c.remoteId === 'host-remote-id');
                if (call) connCall = call; // Helper to capture it
                expect(call).toBeTruthy();
            });

            const mockConn = connCall.conn;

            // Wait for listeners to be attached and 'open' listener to be registered
            await waitFor(() => {
                expect(mockConn.on).toHaveBeenCalledWith('open', expect.any(Function));
            });

            // Get the open callback
            const openCallback = mockConn.on.mock.calls.find((call: any) => call[0] === 'open')[1];

            // Execute it
            await act(async () => {
                openCallback();
            });

            // Verify AUTH message sent
            expect(mockConn.send).toHaveBeenCalledWith({
                type: 'AUTH',
                password: 'secret-password'
            });
        });

        it('should respond with AUTH_STATUS OK when Host receives correct password', async () => {
            const mockLocalStream = { id: 'local-stream', getTracks: () => [] } as any;

            const { result } = renderHook(() => useRemoteSession({
                serverIp: 'localhost',
                myId: 'host-id',
                contacts: [],
                setContacts: vi.fn(),
                setRecentSessions: vi.fn(),
                sessionPassword: 'my-secret-pass',
                unattendedPassword: '',
                localStream: mockLocalStream,
                sources: [],
                currentSourceId: '',
                onFileMessage: vi.fn()
            }));

            const mockConn = {
                peer: 'client-id',
                on: vi.fn(),
                open: true,
                send: vi.fn()
            } as any;

            // Simulate setup listeners for an incoming session
            await act(async () => {
                result.current.setupDataListeners('session-incoming', mockConn, true);
            });

            // Capture data listener
            expect(mockConn.on).toHaveBeenCalledWith('data', expect.any(Function));
            const dataCallback = mockConn.on.mock.calls.find((c: any) => c[0] === 'data')[1];

            // [FIX] Add session to state BEFORE receiving AUTH
            // AND initiate a "incomingCall" to verify auto-answer logic
            const mockIncomingCall = {
                answer: vi.fn(),
                close: vi.fn(),
                on: vi.fn()
            };
            await act(async () => {
                result.current.setSessions((prev) => [
                    ...prev,
                    { id: 'session-incoming', remoteId: 'client-id', isIncoming: true, connected: false, isAuthenticated: false, incomingCall: mockIncomingCall } as any
                ]);
            });

            // Check if call was answered

            // Simulate receiving AUTH
            await act(async () => {
                dataCallback({ type: 'AUTH', password: 'my-secret-pass' });
            });

            // Verify response
            expect(mockConn.send).toHaveBeenCalledWith({
                type: 'AUTH_STATUS',
                status: 'OK'
            });

            // [NEW] Verify call answer
            await waitFor(() => {
                expect(mockIncomingCall.answer).toHaveBeenCalled();
            });

            await waitFor(() => {
                const session = result.current.sessions.find(s => s.id === 'session-incoming');
                expect(session?.isAuthenticated).toBe(true);
            });
        });

        it('should auto-answer when Call arrives AFTER Auth (Race Condition)', async () => {
            const mockLocalStream = { id: 'local-stream', getTracks: () => [] } as any;

            const { result } = renderHook(() => useRemoteSession({
                serverIp: 'localhost',
                myId: 'host-id',
                contacts: [],
                setContacts: vi.fn(),
                setRecentSessions: vi.fn(),
                sessionPassword: 'my-secret-pass',
                unattendedPassword: '',
                localStream: mockLocalStream,
                sources: [],
                currentSourceId: '',
                onFileMessage: vi.fn()
            }));

            const mockConn = {
                peer: 'client-id',
                on: vi.fn(),
                open: true,
                send: vi.fn()
            } as any;

            // 1. Setup Data Listeners
            await act(async () => {
                result.current.setupDataListeners('session-incoming', mockConn, true);
            });

            const dataCallback = mockConn.on.mock.calls.find((c: any) => c[0] === 'data')[1];

            // 2. Add Session WITHOUT incoming call
            await act(async () => {
                result.current.setSessions((prev) => [
                    ...prev,
                    { id: 'session-incoming', remoteId: 'client-id', isIncoming: true, connected: false, isAuthenticated: false, incomingCall: null } as any
                ]);
            });

            // 3. Receive AUTH -> Authenticate
            await act(async () => {
                dataCallback({ type: 'AUTH', password: 'my-secret-pass' });
            });

            // Verify AUTH response sent
            expect(mockConn.send).toHaveBeenCalledWith({
                type: 'AUTH_STATUS',
                status: 'OK'
            });

            // Verify session is authenticated but NO answer yet (no call)
            await waitFor(() => {
                const session = result.current.sessions.find(s => s.id === 'session-incoming');
                expect(session?.isAuthenticated).toBe(true);
            });

            // 4. Simulate Call Arriving LATER
            const mockIncomingCall = {
                answer: vi.fn(),
                close: vi.fn(),
                on: vi.fn()
            };

            await act(async () => {
                result.current.setSessions(prev => prev.map(s =>
                    s.id === 'session-incoming' ? { ...s, incomingCall: mockIncomingCall } : s
                ));
            });

            // 5. Verify Auto-Answer triggered by Effect
            await waitFor(() => {
                expect(mockIncomingCall.answer).toHaveBeenCalled();
            });

        });
    });

});

describe('5. Reconnection Flow', () => {
    it('should handle disconnection and cleanup sessions correctly', async () => {
        const mockLocalStream = { id: 'local-stream', getTracks: () => [] } as any;

        const { result } = renderHook(() => useRemoteSession({
            serverIp: 'localhost',
            myId: 'client-id',
            contacts: [],
            setContacts: vi.fn(),
            setRecentSessions: vi.fn(),
            sessionPassword: '',
            unattendedPassword: '',
            localStream: mockLocalStream,
            sources: [],
            currentSourceId: '',
            onFileMessage: vi.fn()
        }));

        const regs = (window as any)._peerRegistries;

        // Connect
        await act(async () => {
            result.current.connectTo('host-remote-id');
        });

        // Trigger open to establish connection
        await act(async () => {
            const openHandler = regs.onListeners.get('open');
            if (openHandler) openHandler('mock-peer-id');
        });

        // Wait for call and conn to be registered
        let connCall: any;
        let videoCall: any;
        await waitFor(() => {
            connCall = regs.connectCalls.find((c: any) => c.remoteId === 'host-remote-id');
            videoCall = regs.callCalls.find((c: any) => c.remoteId === 'host-remote-id');
            expect(connCall).toBeTruthy();
            expect(videoCall).toBeTruthy();
        });

        const mockConn = connCall.conn;

        // Wait for listeners
        await waitFor(() => {
            expect(mockConn.on).toHaveBeenCalledWith('close', expect.any(Function));
        });

        // Get close handler
        const closeHandler = mockConn.on.mock.calls.find((c: any) => c[0] === 'close')[1];

        // Simulate session is active/connected in state
        await act(async () => {
            result.current.setSessions((prev) => [
                ...prev,
                { ...result.current.sessions[0], connected: true }
            ]);
        });

        // Simulate disconnect (DATA connection close)
        await act(async () => {
            closeHandler();
        });

        // Verify session removed
        await waitFor(() => {
            const session = result.current.sessions.find(s => s.remoteId === 'host-remote-id');
            expect(session).toBeUndefined();
        });
    });

    describe('6. Error Handling', () => {
        it('should close session when Peer is unavailable', async () => {
            const mockLocalStream = { id: 'local-stream', getTracks: () => [] } as any;
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });

            const { result } = renderHook(() => useRemoteSession({
                serverIp: 'localhost',
                myId: 'client-id',
                contacts: [],
                setContacts: vi.fn(),
                setRecentSessions: vi.fn(),
                sessionPassword: '',
                unattendedPassword: '',
                localStream: mockLocalStream,
                sources: [],
                currentSourceId: '',
                onFileMessage: vi.fn()
            }));

            const regs = (window as any)._peerRegistries;

            // 1. Trigger connection
            await act(async () => {
                result.current.connectTo('host-offline-id');
            });

            // 2. Capture the Peer instance
            let peerInstance: any;
            await waitFor(() => {
                peerInstance = regs.instances.find((i: any) => i !== undefined);
                expect(peerInstance).toBeTruthy();
            });

            // 3. Simulate peer-unavailable error
            await act(async () => {
                const errorHandler = regs.onListeners.get('error');
                if (errorHandler) {
                    errorHandler({ type: 'peer-unavailable', message: 'The peer you are trying to connect to does not exist.' });
                }
            });

            // 4. Verify session was removed and alert shown
            await waitFor(() => {
                const session = result.current.sessions.find(s => s.remoteId === 'host-offline-id');
                expect(session).toBeUndefined();
                expect(alertSpy).toHaveBeenCalledWith('O ID remoto não está disponível ou está offline.');
            });
            alertSpy.mockRestore();
        });
    });
});


