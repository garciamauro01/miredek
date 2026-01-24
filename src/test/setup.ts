import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock WebRTC (Required for App.tsx mDNS polyfill)
class MockRTCPeerConnection {
    createDataChannel() { return {}; }
    createOffer() { return Promise.resolve(); }
    createAnswer() { return Promise.resolve(); }
    setLocalDescription() { return Promise.resolve(); }
    setRemoteDescription() { return Promise.resolve(); }
    addIceCandidate() { return Promise.resolve(); }
    onicecandidate = null;
    oniceconnectionstatechange = null;
    ontrack = null;
    addTrack() { }
}
(window as any).RTCPeerConnection = MockRTCPeerConnection;

// Mock Media Element play/pause (Required for autoPlay)
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn(),
});
Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn(),
});
