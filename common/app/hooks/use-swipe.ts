import { useEffect, useState, useCallback } from 'react';

export type Direction = 'left' | 'right';

interface Touch {
    x: number;
    timestamp: number;
}

export const useSwipe = ({
    onSwipe,
    rect,
    distance,
    ms,
}: {
    onSwipe: (direction: Direction) => void;
    rect?: DOMRect;
    distance: number;
    ms: number;
}) => {
    const [start, setStart] = useState<Touch>();
    const insideRect = useCallback(
        (x: number, y: number) => {
            if (rect === undefined) {
                return true;
            }

            return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        },
        [rect]
    );

    useEffect(() => {
        const onTouchStart = (e: TouchEvent) => {
            const x = e.changedTouches[0].clientX;
            const y = e.changedTouches[0].clientY;

            if (insideRect(x, y)) {
                setStart({ x, timestamp: Date.now() });
            }
        };

        document.addEventListener('touchstart', onTouchStart);
        return () => document.removeEventListener('touchstart', onTouchStart);
    }, [insideRect]);

    useEffect(() => {
        if (start === undefined) {
            return;
        }

        const onTouchEnd = (e: TouchEvent) => {
            const x = e.changedTouches[0].clientX;
            const y = e.changedTouches[0].clientY;

            if (insideRect(x, y) && Date.now() - start.timestamp <= ms) {
                if (start.x >= x + distance) {
                    onSwipe('left');
                } else if (start.x <= x - distance) {
                    onSwipe('right');
                }
            }

            setStart(undefined);
        };

        document.addEventListener('touchend', onTouchEnd);
        return () => document.removeEventListener('touchend', onTouchEnd);
    }, [start, distance, ms, onSwipe, insideRect]);
};
