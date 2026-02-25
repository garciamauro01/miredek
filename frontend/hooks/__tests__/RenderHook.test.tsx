import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

describe('RenderHook Test', () => {
    it('should work', () => {
        const { result } = renderHook(() => true);
        expect(result.current).toBe(true);
    });
});
