import { SubtitleModel } from '.';
import KeyEvents from './KeyEvents';
import KeySequence, { KeySequenceTransitionResult } from './KeySequence';
import KeySequences from './KeySequences';

export default class KeyBindings {
    static bindCopy(
        onCopy: (event: KeyboardEvent, subtitle: SubtitleModel) => void,
        disabledGetter: () => boolean,
        subtitleGetter: () => SubtitleModel,
        useCapture = false
    ) {
        return KeyBindings._bindDown((event) => {
            if (disabledGetter()) {
                return;
            }

            if (!KeyEvents.detectCopy(event)) {
                return;
            }

            const subtitle = subtitleGetter();

            if (!subtitle) {
                return;
            }

            onCopy(event, subtitle);
        }, useCapture);
    }

    static bindAnkiExport(
        onAnkiExport: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture = false
    ) {
        return KeyBindings._bindDown((event) => {
            if (disabledGetter()) {
                return;
            }

            if (!KeyEvents.detectAnkiExport(event)) {
                return;
            }

            onAnkiExport(event);
        }, useCapture);
    }

    static bindSeekToSubtitle(
        onSeekToSubtitle: (event: KeyboardEvent, subtitle: SubtitleModel) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        useCapture = false
    ) {
        return KeyBindings._bindDown((event) => {
            if (disabledGetter()) {
                return;
            }

            const subtitles = subtitlesGetter();

            if (!subtitles || subtitles.length === 0) {
                return;
            }

            let forward;

            if (KeyEvents.detectPreviousSubtitle(event)) {
                forward = false;
            } else if (KeyEvents.detectNextSubtitle(event)) {
                forward = true;
            } else {
                return;
            }

            const subtitle = KeyBindings._adjacentSubtitle(forward, timeGetter(), subtitles);

            if (subtitle !== null && subtitle.start >= 0 && subtitle.end >= 0) {
                onSeekToSubtitle(event, subtitle);
            }
        }, useCapture);
    }

    static bindOffsetToSubtitle(
        onOffsetChange: (event: KeyboardEvent, newOffset: number) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        useCapture = false
    ) {
        return KeyBindings._bindDown((event) => {
            if (disabledGetter()) {
                return;
            }

            const subtitles = subtitlesGetter();

            if (!subtitles || subtitles.length === 0) {
                return;
            }

            let forward;

            if (KeyEvents.detectIncreaseOffsetToPreviousSubtitle(event)) {
                forward = false;
            } else if (KeyEvents.detectDecreaseOffsetToNextSubtitle(event)) {
                forward = true;
            } else {
                return;
            }

            const time = timeGetter();
            const subtitle = KeyBindings._adjacentSubtitle(forward, time, subtitles);

            if (subtitle !== null) {
                const subtitleStart = subtitle.originalStart;
                const newOffset = time - subtitleStart;
                onOffsetChange(event, newOffset);
            }
        }, useCapture);
    }

    static _adjacentSubtitle(forward: boolean, time: number, subtitles: SubtitleModel[]) {
        const now = time;
        let adjacentSubtitleIndex = -1;
        let minDiff = Number.MAX_SAFE_INTEGER;

        for (let i = 0; i < subtitles.length; ++i) {
            const s = subtitles[i];
            const diff = forward ? s.start - now : now - s.start;

            if (minDiff <= diff) {
                continue;
            }

            if (forward && now < s.start) {
                minDiff = diff;
                adjacentSubtitleIndex = i;
            } else if (!forward && now > s.start) {
                minDiff = diff;
                adjacentSubtitleIndex = now < s.end ? Math.max(0, i - 1) : i;
            }
        }

        if (adjacentSubtitleIndex !== -1) {
            return subtitles[adjacentSubtitleIndex];
        }

        return null;
    }

    static bindAdjustOffset(
        onOffsetChange: (event: KeyboardEvent, newOffset: number) => void,
        disabledGetter: () => boolean,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        useCapture = false
    ) {
        return KeyBindings._bindDown((event) => {
            if (disabledGetter()) {
                return;
            }

            const subtitles = subtitlesGetter();

            if (!subtitles || subtitles.length === 0) {
                return;
            }

            let increase;

            if (KeyEvents.detectDecreaseOffset(event)) {
                increase = false;
            } else if (KeyEvents.detectIncreaseOffset(event)) {
                increase = true;
            } else {
                return;
            }

            const currentOffset = subtitles[0].start - subtitles[0].originalStart;
            const newOffset = currentOffset + (increase ? 100 : -100);
            onOffsetChange(event, newOffset);
        }, useCapture);
    }

    static bindToggleSubtitles(
        onToggleSubtitles: (event: KeyboardEvent) => void,
        onSequenceAdvanced: () => void,
        disabledGetter: () => boolean,
        useCapture = false
    ) {
        const sequence = KeySequences.toggleSubtitles();
        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                sequence.reset();
                return;
            }

            const transition = sequence.accept(event);

            if (transition.result === KeySequenceTransitionResult.ADVANCED) {
                onSequenceAdvanced();
            } else if (transition.result === KeySequenceTransitionResult.COMPLETE) {
                onToggleSubtitles(event);
            }
        };
        const unbindDown = KeyBindings._bindDown(handler, useCapture);
        const unbindUp = KeyBindings._bindUp(handler, useCapture);

        return () => {
            unbindDown();
            unbindUp();
        };
    }

    static bindToggleSubtitleTrackInVideo(
        onToggleSubtitleTrack: (event: KeyboardEvent, extra: any) => void,
        onSequenceAdvanced: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture = false
    ) {
        const sequence = KeySequences.toggleSubtitleTrack();
        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                sequence.reset();
                return;
            }

            const transition = sequence.accept(event);

            if (transition.result === KeySequenceTransitionResult.ADVANCED) {
                onSequenceAdvanced(event);
            } else if (transition.result === KeySequenceTransitionResult.COMPLETE) {
                onToggleSubtitleTrack(event, transition.extra);
            }
        };
        const unbindDown = KeyBindings._bindDown(handler, useCapture);
        const unbindUp = KeyBindings._bindUp(handler, useCapture);

        return () => {
            unbindDown();
            unbindUp();
        };
    }

    static bindToggleSubtitleTrackInList(
        onToggleSubtitleTrackInList: (event: KeyboardEvent, extra: any) => void,
        onSequenceAdvanced: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture = false
    ) {
        const sequence = KeySequences.toggleSubtitleTrackInList();
        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                sequence.reset();
                return;
            }

            const transition = sequence.accept(event);

            if (transition.result === KeySequenceTransitionResult.ADVANCED) {
                onSequenceAdvanced(event);
            } else if (transition.result === KeySequenceTransitionResult.COMPLETE) {
                onToggleSubtitleTrackInList(event, transition.extra);
            }
        };
        const unbindDown = KeyBindings._bindDown(handler, useCapture);
        const unbindUp = KeyBindings._bindUp(handler, useCapture);

        return () => {
            unbindDown();
            unbindUp();
        };
    }

    static bindPlay(onPlay: (event: KeyboardEvent) => void, disabledGetter: () => boolean, useCapture = false) {
        return KeyBindings._bindDown((event) => {
            if (disabledGetter()) {
                return;
            }

            if (!KeyEvents.detectPlay(event)) {
                return;
            }

            onPlay(event);
        }, useCapture);
    }

    static _bindDown(handler: (event: KeyboardEvent) => void, useCapture: boolean) {
        window.addEventListener('keydown', handler, useCapture);

        return () => window.removeEventListener('keydown', handler, useCapture);
    }

    static _bindUp(handler: (event: KeyboardEvent) => void, useCapture: boolean) {
        window.addEventListener('keyup', handler, useCapture);

        return () => window.removeEventListener('keyup', handler, useCapture);
    }
}
