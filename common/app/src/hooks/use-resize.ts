import { useCallback, useEffect, useState } from 'react';

interface Props {
    initialWidth: number;
    minWidth: number;
    maxWidth: number;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;
}

// https://stackoverflow.com/questions/49469834/recommended-way-to-have-drawer-resizable
export const useResize = ({ initialWidth, minWidth, maxWidth, onResizeStart, onResizeEnd }: Props) => {
    const [isResizing, setIsResizing] = useState(false);
    const [width, setWidth] = useState(initialWidth);

    const enableResize = useCallback(() => {
        setIsResizing(true);
        onResizeStart?.();
    }, [setIsResizing, onResizeStart]);

    const disableResize = useCallback(() => {
        setIsResizing(false);
        onResizeEnd?.();
    }, [setIsResizing, onResizeEnd]);

    const resize = useCallback(
        (e: MouseEvent) => {
            if (isResizing) {
                const newWidth = window.innerWidth - e.clientX;
                if (newWidth >= minWidth && newWidth <= maxWidth) {
                    setWidth(newWidth);
                }
            }
        },
        [minWidth, maxWidth, isResizing]
    );

    useEffect(() => {
        document.addEventListener('mouseleave', disableResize);
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', disableResize);

        return () => {
            document.removeEventListener('mouseleave', disableResize);
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', disableResize);
        };
    }, [disableResize, resize]);

    return { width, enableResize, isResizing };
};
