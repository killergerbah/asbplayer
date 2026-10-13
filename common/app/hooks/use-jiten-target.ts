import { useEffect, useState } from 'react';
import { isJitenTarget, jitenSurfaceForm, stripJitenMarkers } from '@project/common/jiten/jiten';
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

export const useJitenTarget = () => {
    const [target, setTarget] = useState(readJitenTarget);
    useEffect(() => {
        const activeWords = new Map<string, JitenTarget>();
        const receive = (event: MessageEvent) => {
            const data = event.data;
            const type = data?.type;
            if (
                event.source !== window ||
                event.origin !== location.origin ||
                data?.source !== 'jiten-reader' ||
                data.version !== 1 ||
                !isJitenTarget(data)
            )
                return;
            const key = `${data.wordId}/${data.readingIndex}`;
            if (type === 'active-word-changed') {
                activeWords.set(key, data);
                return;
            }
            if (type !== 'card-mined') return;
            // Mining-deck events omit markers; the matching active event supplies the inflected form.
            const active = activeWords.get(key);
            const context =
                active &&
                (data.sentence === undefined ||
                    stripJitenMarkers(data.sentence) === stripJitenMarkers(active.sentence ?? ''))
                    ? active
                    : undefined;
            const target: JitenTarget = {
                wordId: data.wordId,
                readingIndex: data.readingIndex,
                spelling: data.spelling,
                reading: data.reading,
                sentence: data.sentence ?? context?.sentence,
                surfaceForm: jitenSurfaceForm(data) ?? active?.surfaceForm,
                sourceTitle: data.sourceTitle,
            };
            localStorage.setItem(storageKey, JSON.stringify(target));
            setTarget(target);
        };
        const sync = (event: StorageEvent) => {
            if (event.key === storageKey) setTarget(readJitenTarget());
        };
        window.addEventListener('message', receive);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('message', receive);
            window.removeEventListener('storage', sync);
        };
    }, []);
    return target;
};
