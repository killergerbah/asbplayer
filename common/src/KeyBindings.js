import KeyEvents from './KeyEvents';
import KeySequence from './KeySequence';
import KeySequences from './KeySequences';

export default class KeyBindings {

    static bindCopy(onCopy, disabledGetter, subtitleGetter, useCapture = false) {
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

    static bindAnkiExport(onAnkiExport, disabledGetter, useCapture = false) {
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

    static bindSeekToSubtitle(onSeekToSubtitle, disabledGetter, timeGetter, subtitlesGetter, useCapture = false) {
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

    static bindOffsetToSubtitle(onOffsetChange, disabledGetter, timeGetter, subtitlesGetter, useCapture = false) {
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

    static _adjacentSubtitle(forward, time, subtitles) {
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

    static bindAdjustOffset(onOffsetChange, disabledGetter, subtitlesGetter, useCapture = false) {
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

    static bindToggleSubtitles(onToggleSubtitles, onSequenceAdvanced, disabledGetter, useCapture = false) {
        const sequence = KeySequences.toggleSubtitles();
        const handler = (event) => {
            if (disabledGetter()) {
                sequence.reset();
                return;
            }

            const transition = sequence.accept(event);

            if (transition.result === KeySequence.ADVANCED) {
                onSequenceAdvanced();
            } else if (transition.result === KeySequence.COMPLETE) {
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

    static bindToggleSubtitleTrack(onToggleSubtitleTrack, onSequenceAdvanced, disabledGetter, useCapture = false) {
        const sequence = KeySequences.toggleSubtitleTrack();
        const handler = (event) => {
            if (disabledGetter()) {
                sequence.reset();
                return;
            }

            const transition = sequence.accept(event);

            if (transition.result === KeySequence.ADVANCED) {
                onSequenceAdvanced();
            } else if (transition.result === KeySequence.COMPLETE) {
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

    static bindPlay(onPlay, disabledGetter, useCapture = false) {
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

    static _bindDown(handler, useCapture) {
        window.addEventListener('keydown', handler, useCapture);

        return () => window.removeEventListener('keydown', handler, useCapture);
    }

    static _bindUp(handler, useCapture) {
        window.addEventListener('keyup', handler, useCapture);

        return () => window.removeEventListener('keyup', handler, useCapture);
    }
}