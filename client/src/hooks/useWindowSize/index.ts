import { useLayoutEffect, useState } from 'react';

// https://stackoverflow.com/questions/19014250/rerender-view-on-browser-resize-with-react
export function useWindowSize(enabled: boolean) {
    const [size, setSize] = useState([0, 0]);

    useLayoutEffect(() => {
        function updateSize() {
            if (enabled) {
                setSize([window.innerWidth, window.innerHeight]);
            }
        }

        window.addEventListener('resize', updateSize);
        updateSize();

        return () => window.removeEventListener('resize', updateSize);
    }, [enabled]);

    return size;
}
