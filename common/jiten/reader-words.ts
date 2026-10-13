import type { SubtitleModel } from '@project/common';
import { ASB_SUBTITLE_INDEX_ATTRIBUTE } from '@project/common/annotations/dom-annotations';
import { extractText } from '@project/common/util';
import { highlightJitenWord, isJitenTarget } from '@project/common/jiten/jiten';
import type { JitenTarget } from '@project/common/jiten/jiten';

export function readJitenWords(subtitle: SubtitleModel, surrounding: SubtitleModel[]): JitenTarget[] {
    const sentence = extractText(subtitle, surrounding);
    const words = new Map<string, JitenTarget>();
    for (const captured of [subtitle, ...surrounding]) {
        if (captured.end <= subtitle.start || captured.start >= subtitle.end || !('index' in captured)) continue;
        for (const root of document.querySelectorAll(`[${ASB_SUBTITLE_INDEX_ATTRIBUTE}="${captured.index}"]`)) {
            const elements = Array.from(root.querySelectorAll('.jiten-word[wordId][readingIndex]'));
            for (let i = 0; i < elements.length; i++) {
                const first = elements[i];
                let last = first;
                while (i + 1 < elements.length) {
                    const next = elements[i + 1];
                    if (
                        next.getAttribute('wordId') !== first.getAttribute('wordId') ||
                        next.getAttribute('readingIndex') !== first.getAttribute('readingIndex')
                    )
                        break;
                    const gap = document.createRange();
                    gap.setStartAfter(last);
                    gap.setEndBefore(next);
                    if (gap.toString()) break;
                    last = next;
                    i++;
                }
                const range = document.createRange();
                range.setStartBefore(first);
                range.setEndAfter(last);
                const content = range.cloneContents();
                const readingContent = content.cloneNode(true) as DocumentFragment;
                readingContent.querySelectorAll('ruby').forEach((ruby) => {
                    const kana = Array.from(ruby.querySelectorAll('rt'))
                        .map((rt) => rt.textContent)
                        .join('');
                    ruby.querySelectorAll('rt, rp').forEach((node) => node.remove());
                    if (kana) ruby.append(document.createTextNode(`[${kana}]`));
                });
                const reading = readingContent.textContent ?? '';
                content.querySelectorAll('rt, rp').forEach((node) => node.remove());
                const surfaceForm = content.textContent ?? '';
                if (!surfaceForm || !sentence.includes(surfaceForm)) continue;
                const target: JitenTarget = {
                    wordId: Number(first.getAttribute('wordId')),
                    readingIndex: Number(first.getAttribute('readingIndex')),
                    spelling: surfaceForm,
                    reading,
                    surfaceForm,
                };
                if (!isJitenTarget(target)) continue;
                target.sentence = highlightJitenWord(sentence, target);
                const key = `${target.wordId}/${target.readingIndex}`;
                if (!words.has(key)) words.set(key, target);
            }
        }
    }
    return [...words.values()];
}
