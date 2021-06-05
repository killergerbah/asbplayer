import KeyEvents from './KeyEvents';

export default class KeyBindings {

    static bindCopy(onCopy, disabledGetter, subtitleGetter) {
        return KeyBindings._bind((event) => {
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
        });
    }

    static bindSeekToSubtitle(onSeekToSubtitle, disabledGetter, timeGetter, subtitlesGetter) {
        return KeyBindings._bind((event) => {
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

            if (subtitle !== null) {
                onSeekToSubtitle(event, subtitle);
            }
        });
    }

    static bindOffsetToSubtitle(onOffsetChange, disabledGetter, timeGetter, subtitlesGetter) {
        return KeyBindings._bind((event) => {
            if (disabledGetter()) {
                return;
            }

            const subtitles = subtitlesGetter();

            if (!subtitles || subtitles.length === 0) {
                return;
            }

            let forward;

            if (KeyEvents.detectDecreaseOffsetToPreviousSubtitle(event)) {
                forward = false;
            } else if (KeyEvents.detectIncreaseOffsetToNextSubtitle(event)) {
                forward = true;
            } else {
                return;
            }

            const time = timeGetter();
            const subtitle = KeyBindings._adjacentSubtitle(forward, time, subtitles);

            if (subtitle !== null) {
                event.preventDefault();
                event.stopPropagation();
                const subtitleStart = subtitle.originalStart;
                const newOffset = Math.round(1000 * time) - subtitleStart;
                onOffsetChange(event, newOffset);
            }
        });
    }

    static _adjacentSubtitle(forward, time, subtitles) {
        const now = Math.round(1000 * time);
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

    static bindAdjustOffset(onOffsetChange, disabledGetter, subtitlesGetter) {
        return KeyBindings._bind((event) => {
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

            event.preventDefault();
            event.stopPropagation();
            const currentOffset = subtitles[0].start - subtitles[0].originalStart;
            const newOffset = currentOffset + (increase ? 100 : -100);
            onOffsetChange(event, newOffset);
        });
    }

    static _bind(handler) {
        window.addEventListener('keydown', handler);

        return () => window.removeEventListener('keydown', handler);
    }
}