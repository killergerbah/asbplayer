import { useCallback, useEffect, useState } from 'react';

export const useFullscreen = () => {
    const [fullscreen, setFullscreen] = useState<boolean>(document.fullscreenElement != null);
    useEffect(() => {
        const listener = () => {
            setFullscreen(document.fullscreenElement != null);
        };
        document.addEventListener('fullscreenchange', listener);
        return () => document.removeEventListener('fullscreenchange', listener);
    }, []);
    const requestFullscreen = useCallback((newFullscreen: boolean) => {
        if (newFullscreen && !document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else if (!newFullscreen && document.fullscreenElement) {
            document.exitFullscreen();
        }
    }, []);
    return { fullscreen, requestFullscreen };
};
