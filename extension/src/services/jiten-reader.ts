import type { SubtitleModel } from '@project/common';
import { isJitenTarget } from '@project/common/jiten/jiten';
import { listenJitenTarget } from '@project/common/jiten/reader-events';
import { readJitenWords } from '@project/common/jiten/reader-words';

const targetKey = 'jiten-mined-target';
export const listenForJitenTarget = (targetWindow: Window) =>
    listenJitenTarget((target) => {
        void browser.storage.local.set({ [targetKey]: target });
    }, targetWindow);

listenForJitenTarget(window);

export async function readJitenCapture(subtitle: SubtitleModel, surrounding: SubtitleModel[]) {
    const stored = (await browser.storage.local.get(targetKey))[targetKey];
    return {
        miningDestination: 'jiten' as const,
        jitenTarget: isJitenTarget(stored) ? stored : undefined,
        jitenWords: readJitenWords(subtitle, surrounding),
    };
}
