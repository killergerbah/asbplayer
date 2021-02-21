import { useLayoutEffect, useState } from 'react';

export function arrayEquals(a, b, equals = (a, b) => a === b) {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; ++i) {
        if (!equals(a[i], b[i])) {
            return false;
        }
    }

    return true;
}

export function keysAreEqual(a, b) {
    for (let key in a) {
        if (!(key in b)) {
            return false;
        }
    }

    for (let key in b) {
        if (!(key in a)) {
            return false;
        }
    }

    return true;
}

// https://stackoverflow.com/questions/19014250/rerender-view-on-browser-resize-with-react
export function useWindowSize(enabled) {
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
