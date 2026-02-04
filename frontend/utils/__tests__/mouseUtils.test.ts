import { describe, it, expect } from 'vitest';
import { getRelativeMousePos } from '../mouseUtils';

describe('mouseUtils - getRelativeMousePos', () => {
    const createMockVideo = (width: number, height: number, clientWidth: number, clientHeight: number) => {
        return {
            videoWidth: width,
            videoHeight: height,
            clientWidth: clientWidth,
            clientHeight: clientHeight,
            getBoundingClientRect: () => ({
                left: 100,
                top: 100,
                width: clientWidth,
                height: clientHeight,
                right: 100 + clientWidth,
                bottom: 100 + clientHeight,
            })
        } as unknown as HTMLVideoElement;
    };

    const createMouseEvent = (clientX: number, clientY: number) => {
        return {
            clientX,
            clientY,
        } as unknown as React.MouseEvent;
    };

    it('should return null if video is null', () => {
        expect(getRelativeMousePos({} as any, null)).toBeNull();
    });

    describe('viewMode: stretch', () => {
        it('should calculate middle position correctly', () => {
            const video = createMockVideo(1920, 1080, 800, 600);
            const event = createMouseEvent(100 + 400, 100 + 300); // Middle of 800x600 element at 100,100
            const pos = getRelativeMousePos(event, video, 'stretch');
            expect(pos).toEqual({ x: 0.5, y: 0.5 });
        });

        it('should calculate top-left corner correctly', () => {
            const video = createMockVideo(1920, 1080, 800, 600);
            const event = createMouseEvent(100, 100);
            const pos = getRelativeMousePos(event, video, 'stretch');
            expect(pos).toEqual({ x: 0, y: 0 });
        });

        it('should calculate bottom-right corner correctly', () => {
            const video = createMockVideo(1920, 1080, 800, 600);
            const event = createMouseEvent(100 + 800, 100 + 600);
            const pos = getRelativeMousePos(event, video, 'stretch');
            expect(pos).toEqual({ x: 1, y: 1 });
        });
    });

    describe('viewMode: fit (contain)', () => {
        it('should handle Pillarbox (wider element than video)', () => {
            // Video 16:9 (ratio 1.77) in Element 2:1 (ratio 2.0)
            // Element: 800x400. Video should be 400 * 1.77 = 711.11 wide.
            // Offset X = (800 - 711.11) / 2 = 44.44
            const video = createMockVideo(1600, 900, 800, 400);

            // Left edge of actual video area
            const eventLeft = createMouseEvent(100 + 44.44, 200);
            expect(getRelativeMousePos(eventLeft, video, 'fit')?.x).toBeCloseTo(0, 3);

            // Right edge of actual video area
            const eventRight = createMouseEvent(100 + 800 - 44.44, 200);
            expect(getRelativeMousePos(eventRight, video, 'fit')?.x).toBeCloseTo(1, 3);

            // Outside video area (in pillarbox)
            const eventOutside = createMouseEvent(100 + 10, 200);
            expect(getRelativeMousePos(eventOutside, video, 'fit')).toBeNull();
        });

        it('should handle Letterbox (taller element than video)', () => {
            // Video 16:9 (ratio 1.77) in Element 4:3 (ratio 1.33)
            // Element: 800x600. Video should be 800 / 1.77 = 450 high.
            // Offset Y = (600 - 450) / 2 = 75
            const video = createMockVideo(1600, 900, 800, 600);

            // Top edge of actual video area
            const eventTop = createMouseEvent(400, 100 + 75);
            expect(getRelativeMousePos(eventTop, video, 'fit')?.y).toBeCloseTo(0, 3);

            // Bottom edge of actual video area
            const eventBottom = createMouseEvent(400, 100 + 600 - 75);
            expect(getRelativeMousePos(eventBottom, video, 'fit')?.y).toBeCloseTo(1, 3);
        });
    });

    describe('Fallback Logic', () => {
        it('should use element size if videoWidth is 0', () => {
            const video = createMockVideo(0, 0, 800, 600);
            const event = createMouseEvent(100 + 400, 100 + 300);
            const pos = getRelativeMousePos(event, video, 'fit');
            expect(pos).toEqual({ x: 0.5, y: 0.5 });
        });
    });

    describe('Edge Cases and Clamping', () => {
        it('should clamp values slightly outside [0, 1] due to epsilon', () => {
            const video = createMockVideo(1000, 1000, 1000, 1000);
            // x = 100.0005 - 100 = 0.0005. finalX = 0.0000005 (within epsilon)
            const eventNearZero = createMouseEvent(100 - 0.5, 100);
            const pos = getRelativeMousePos(eventNearZero, video, 'stretch');
            expect(pos?.x).toBe(0);

            const eventNearOne = createMouseEvent(100 + 1000 + 0.5, 100);
            const posOne = getRelativeMousePos(eventNearOne, video, 'stretch');
            expect(posOne?.x).toBe(1);
        });

        it('should return null for positions significantly outside', () => {
            const video = createMockVideo(1000, 1000, 1000, 1000);
            const eventFar = createMouseEvent(50, 50); // rect.left is 100
            expect(getRelativeMousePos(eventFar, video, 'stretch')).toBeNull();
        });
    });
});
