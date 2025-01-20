import { useEffect, useRef } from 'react';

interface Params {
    rect: DOMRect;
    onDoubleTouch: (section: Section) => void;
}

type Section = 'left' | 'right';

interface TouchModel {
    section: Section;
    timestamp: number;
}

const intersection = (rect: DOMRect, touch: Touch) => {
    if (touch.clientX < rect.x || touch.clientX > rect.x + rect.width) {
        return undefined;
    }

    if (touch.clientY < rect.y || touch.clientY > rect.y + rect.height) {
        return undefined;
    }

    return touch.clientX < rect.x + rect.width / 2 ? 'left' : 'right';
};

export const useDoubleTouch = ({ onDoubleTouch }: Params) => {
    const lastTouchRef = useRef<TouchModel>();

    useEffect(() => {
        const listener = (e: TouchEvent) => {
            for (const touch of e.changedTouches) {
                const section = intersection(document.body.getBoundingClientRect(), touch);

                if (section !== undefined) {
                    if (lastTouchRef.current === undefined || lastTouchRef.current.timestamp < Date.now() - 500) {
                        lastTouchRef.current = { timestamp: Date.now(), section };
                    } else {
                        onDoubleTouch(section);
                        lastTouchRef.current = undefined;
                    }

                    break;
                }
            }
        };
        document.addEventListener('touchend', listener);
        return () => document.removeEventListener('touchend', listener);
    }, [onDoubleTouch]);
};
