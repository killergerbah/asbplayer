import { useEffect, useState } from 'react';
import { listenJitenTarget } from '@project/common/jiten/reader-events';
import { isJitenTarget } from '@project/common/jiten/jiten';
import type { JitenTarget } from '@project/common/jiten/jiten';

const storageKey = 'jiten-mined-target';

export const readJitenTarget = (): JitenTarget | undefined => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return undefined;
    try {
        const target: unknown = JSON.parse(stored);
        return isJitenTarget(target) ? target : undefined;
    } catch {
        return undefined;
    }
};

export const useJitenTarget = (onMined?: (target: JitenTarget) => void) => {
    const [target, setTarget] = useState(readJitenTarget);
    useEffect(() => {
        const stop = listenJitenTarget((target) => {
            localStorage.setItem(storageKey, JSON.stringify(target));
            setTarget(target);
            onMined?.(target);
        });
        const sync = (event: StorageEvent) => {
            if (event.key === storageKey) setTarget(readJitenTarget());
        };
        window.addEventListener('storage', sync);
        return () => {
            stop();
            window.removeEventListener('storage', sync);
        };
    }, [onMined]);
    return target;
};
