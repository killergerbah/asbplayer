import { useEffect, useState } from 'react';

export const useDocumentHasFocus = () => {
    const [hasFocus, setHasFocus] = useState<boolean>(document.hasFocus());

    useEffect(() => {
        const update = () => {
            setHasFocus(document.hasFocus());
        };
        window.addEventListener('focus', update);
        window.addEventListener('blur', update);

        return () => {
            window.removeEventListener('focus', update);
            window.removeEventListener('blur', update);
        };
    }, []);

    return hasFocus;
};
