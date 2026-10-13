import { isJitenTarget, jitenSurfaceForm, stripJitenMarkers } from '@project/common/jiten/jiten';
import type { JitenTarget } from '@project/common/jiten/jiten';

export function listenJitenTarget(onTarget: (target: JitenTarget) => void, targetWindow: Window = window) {
    const activeWords = new Map<string, JitenTarget>();
    const receive = (event: MessageEvent) => {
        const data = event.data;
        const type = data?.type;
        if (
            event.source !== targetWindow ||
            event.origin !== targetWindow.origin ||
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
        onTarget(target);
    };
    targetWindow.addEventListener('message', receive);
    return () => targetWindow.removeEventListener('message', receive);
}
