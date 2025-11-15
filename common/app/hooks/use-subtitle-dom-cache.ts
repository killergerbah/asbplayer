import { IndexedSubtitleModel, OffscreenDomCache, SubtitleModel } from '@project/common';
import { useEffect, useState } from 'react';

export const useSubtitleDomCache = (
    subtitles: IndexedSubtitleModel[],
    render: (subtitle: IndexedSubtitleModel) => string
) => {
    const [domCache, setDomCache] = useState<OffscreenDomCache>(new OffscreenDomCache());

    useEffect(() => {
        const domCache = new OffscreenDomCache();
        setDomCache(domCache);
        return () => domCache.clear();
    }, [subtitles, render]);

    return {
        getSubtitleDomCache: () => {
            if (domCache.empty) {
                for (const subtitle of subtitles) {
                    domCache.add(String(subtitle.index), render(subtitle));
                }
            }

            return domCache;
        },
    };
};
