// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRemoteSession } from '../useRemoteSession';

// --- MOCKS ---
const mockElectronAPI = {
    getSources: vi.fn(),
    writeClipboard: vi.fn(),
    executeInput: vi.fn(),
};
Object.defineProperty(window, 'electronAPI', { value: mockElectronAPI, writable: true });

describe('Monitor Switching Flow Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Host: should call selectSource when receiving SWITCH_MONITOR message', async () => {
        const selectSource = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useRemoteSession({
            serverIp: 'localhost',
            myId: 'host-id',
            contacts: [],
            setContacts: vi.fn(),
            setRecentSessions: vi.fn(),
            sessionPassword: 'pass',
            unattendedPassword: '',
            localStream: {} as any,
            sources: [],
            currentSourceId: 'screen-1',
            selectSource,
            onFileMessage: vi.fn()
        }));

        const mockConn = {
            peer: 'client-id',
            on: vi.fn(),
            open: true,
            send: vi.fn()
        } as any;

        // 1. Setup listeners for an incoming session
        await act(async () => {
            result.current.setupDataListeners('session-host', mockConn, true);
        });

        // 2. Add as an active session in state (Host side)
        await act(async () => {
            result.current.setSessions([
                { id: 'session-host', remoteId: 'client-id', isIncoming: true, connected: true, isAuthenticated: true } as any
            ]);
        });

        // 3. Capture data listener and simulate SWITCH_MONITOR
        const dataCallback = mockConn.on.mock.calls.find((c: any) => c[0] === 'data')[1];

        await act(async () => {
            dataCallback({ type: 'SWITCH_MONITOR', sourceId: 'screen-2' });
        });

        // 4. Verify host triggered the actual capture switch
        expect(selectSource).toHaveBeenCalledWith('screen-2');

        // 5. Verify host notified client back
        expect(mockConn.send).toHaveBeenCalledWith({
            type: 'MONITOR_CHANGED',
            activeSourceId: 'screen-2'
        });
    });

    it('Client: should update remoteSources and activeSourceId on SOURCES_LIST', async () => {
        const { result } = renderHook(() => useRemoteSession({
            serverIp: 'localhost',
            myId: 'client-id',
            contacts: [],
            setContacts: vi.fn(),
            setRecentSessions: vi.fn(),
            sessionPassword: '',
            unattendedPassword: '',
            localStream: {} as any,
            sources: [],
            currentSourceId: '',
            selectSource: vi.fn(),
            onFileMessage: vi.fn()
        }));

        const mockConn = { peer: 'host-id', on: vi.fn(), open: true, send: vi.fn() } as any;

        await act(async () => {
            result.current.setupDataListeners('session-client', mockConn, false);
            result.current.setSessions([
                { id: 'session-client', remoteId: 'host-id', isIncoming: false } as any
            ]);
        });

        const dataCallback = mockConn.on.mock.calls.find((c: any) => c[0] === 'data')[1];

        const mockSources = [{ id: 's1', name: 'M1' }, { id: 's2', name: 'M2' }];
        await act(async () => {
            dataCallback({ type: 'SOURCES_LIST', sources: mockSources, activeSourceId: 's1' });
        });

        const session = result.current.sessions.find(s => s.id === 'session-client');
        expect(session?.remoteSources).toEqual(mockSources);
        expect(session?.activeSourceId).toBe('s1');
    });
});
