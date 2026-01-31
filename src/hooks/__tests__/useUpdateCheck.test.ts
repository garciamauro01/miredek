// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUpdateCheck } from '../useUpdateCheck';

// Mock global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Mock window.electronAPI
const mockGetAppVersion = vi.fn();

Object.defineProperty(window, 'electronAPI', {
    value: {
        getAppVersion: mockGetAppVersion,
    },
    writable: true
});

describe('useUpdateCheck', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default app version
        mockGetAppVersion.mockResolvedValue('1.0.0');
    });

    it('should query the correct URL with the provided serverIp', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ version: '1.0.0', downloadUrl: '/setup.exe' }),
            text: async () => JSON.stringify({ version: '1.0.0', downloadUrl: '/setup.exe' })
        });

        renderHook(() => useUpdateCheck('192.168.1.10'));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalled();
            const url = fetchMock.mock.calls[0][0];
            expect(url).toContain('http://192.168.1.10:3001/version');
            expect(url).toContain('?t='); // Cache busting
        });
    });

    it('should map "cloud" to the default 167.234.241.147 IP', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ version: '1.0.0', downloadUrl: '/setup.exe' }),
            text: async () => JSON.stringify({ version: '1.0.0', downloadUrl: '/setup.exe' })
        });

        renderHook(() => useUpdateCheck('cloud'));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalled();
            const url = fetchMock.mock.calls[0][0];
            expect(url).toContain('http://167.234.241.147:3001/version');
        });
    });

    it('should set updateAvailable when versions differ', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ version: '1.0.1', downloadUrl: '/setup.exe', critical: false, releaseNotes: 'Fix' }),
            text: async () => JSON.stringify({ version: '1.0.1', downloadUrl: '/setup.exe', critical: false, releaseNotes: 'Fix' })
        });

        const { result } = renderHook(() => useUpdateCheck('localhost'));

        await waitFor(() => {
            expect(result.current.updateAvailable).not.toBeNull();
            expect(result.current.updateAvailable?.version).toBe('1.0.1');
        });
    });

    it('should NOT set updateAvailable when versions are equal', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ version: '1.0.0', downloadUrl: '/setup.exe' }),
            text: async () => JSON.stringify({ version: '1.0.0', downloadUrl: '/setup.exe' })
        });

        const { result } = renderHook(() => useUpdateCheck('localhost'));

        await waitFor(() => {
            expect(result.current.updateAvailable).toBeNull();
        });
    });

    it('should handle network errors gracefully', async () => {
        fetchMock.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useUpdateCheck('localhost'));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalled();
            expect(result.current.updateAvailable).toBeNull();
        });
    });

    it('should handle invalid JSON response', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            text: async () => 'Internal Server Error' // Not JSON
        });

        const { result } = renderHook(() => useUpdateCheck('localhost'));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalled();
            expect(result.current.updateAvailable).toBeNull();
        });
    });
});
