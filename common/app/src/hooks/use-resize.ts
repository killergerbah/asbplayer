import { useCallback, useEffect, useState } from 'react';

interface Props {
    initialWidth: number;
    minWidth: number;
    maxWidth: number;
}

// https://stackoverflow.com/questions/49469834/recommended-way-to-have-drawer-resizable
export const useResize = ({ initialWidth, minWidth, maxWidth }: Props) => {
    const [isResizing, setIsResizing] = useState(false);
    const [width, setWidth] = useState(initialWidth);

    const enableResize = useCallback(() => {
        setIsResizing(true);
    }, [setIsResizing]);

    const disableResize = useCallback(() => {
        setIsResizing(false);
    }, [setIsResizing]);

    const resize = useCallback(
        (e: MouseEvent) => {
            if (isResizing) {
                const newWidth = maxWidth - e.clientX + 25;
                if (newWidth >= minWidth) {
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
            document.removeEventListener('mouseleave', resize);
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', disableResize);
        };
    }, [disableResize, resize]);

    return { width, enableResize, isResizing };
};
