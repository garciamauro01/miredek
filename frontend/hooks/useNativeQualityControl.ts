import { useCallback } from 'react';

export interface QualitySettings {
    level: number;
    jpegQuality: number;
    blockSize: number;
    targetBitrate: number;
}

export function useNativeQualityControl(agentUrl: string) {
    // Get current quality settings from native agent
    const getCurrentQuality = useCallback(async (): Promise<QualitySettings | null> => {
        try {
            const response = await fetch(`${agentUrl}/quality`);
            if (!response.ok) return null;
            
            const data = await response.json();
            return {
                level: data.level,
                jpegQuality: data.jpegQuality,
                blockSize: data.blockSize,
                targetBitrate: data.targetBitrate
            };
        } catch (err) {
            console.error('[NativeQualityControl] Failed to get quality:', err);
            return null;
        }
    }, [agentUrl]);

    // Set quality level on native agent
    const setQualityLevel = useCallback(async (level: number): Promise<boolean> => {
        try {
            const response = await fetch(`${agentUrl}/quality`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ level })
            });

            if (!response.ok) return false;

            const data = await response.json();
            if (data.success) {
                console.log(
                    `[NativeQualityControl] Quality updated: Level ${data.level}, ` +
                    `JPEG ${data.jpegQuality}%, BlockSize ${data.blockSize}px`
                );
                return true;
            }
            return false;
        } catch (err) {
            console.error('[NativeQualityControl] Failed to set quality:', err);
            return false;
        }
    }, [agentUrl]);

    return {
        getCurrentQuality,
        setQualityLevel
    };
}
