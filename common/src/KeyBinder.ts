import { SubtitleModel } from './Model';
import hotkeys from 'hotkeys-js';
import { KeyBindSet } from './Settings';

export interface KeyBinder {
    bindCopy<T extends SubtitleModel = SubtitleModel>(
        onCopy: (event: KeyboardEvent, subtitle: T) => void,
        disabledGetter: () => boolean,
        subtitleGetter: () => T | undefined,
        useCapture?: boolean
    ): () => void;
    bindAnkiExport(
        onAnkiExport: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean
    ): () => void;
    bindUpdateLastCard(
        onUpdateLastCard: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean
    ): () => void;
    bindSeekToSubtitle(
        onSeekToSubtitle: (event: KeyboardEvent, subtitle: SubtitleModel) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        useCapture?: boolean
    ): () => void;
    bindSeekToBeginningOfCurrentSubtitle(
        onSeekToBeginningOfCurrentSubtitle: (event: KeyboardEvent, subtitle: SubtitleModel) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        useCapture?: boolean
    ): () => void;
    bindSeekBackwardOrForward(
        onSeekBackwardOrForward: (event: KeyboardEvent, forward: boolean) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean
    ): () => void;
    bindOffsetToSubtitle(
        onOffsetChange: (event: KeyboardEvent, newOffset: number) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        useCapture?: boolean
    ): () => void;
    bindAdjustOffset(
        onOffsetChange: (event: KeyboardEvent, newOffset: number) => void,
        disabledGetter: () => boolean,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        useCapture?: boolean
    ): () => void;
    bindResetOffet(
        onResetOffset: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean
    ): () => void;
    bindAdjustPlaybackRate(
        onAdjustPlaybackRate: (event: KeyboardEvent, increase: boolean) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean
    ): () => void;
    bindToggleSubtitles(
        onToggleSubtitles: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean
    ): () => void;
    bindToggleSubtitleTrackInVideo(
        onToggleSubtitleTrack: (event: KeyboardEvent, extra: any) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean
    ): () => void;
    bindToggleSubtitleTrackInList(
        onToggleSubtitleTrackInList: (event: KeyboardEvent, extra: any) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean
    ): () => void;
    bindPlay(onPlay: (event: KeyboardEvent) => void, disabledGetter: () => boolean, useCapture?: boolean): () => void;
    bindAutoPause(
        onAutoPause: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean
    ): () => void;
    bindCondensedPlayback(
        onCondensedPlayback: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean
    ): () => void;
}

export class DefaultKeyBinder implements KeyBinder {
    private readonly keyBindSet: KeyBindSet;

    constructor(keyBindSet: KeyBindSet) {
        this.keyBindSet = keyBindSet;
    }
    bindCopy<T extends SubtitleModel = SubtitleModel>(
        onCopy: (event: KeyboardEvent, subtitle: T) => void,
        disabledGetter: () => boolean,
        subtitleGetter: () => T | undefined,
        useCapture = false
    ) {
        const shortcut = this.keyBindSet.copySubtitle.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = this.copyHandler(onCopy, disabledGetter, subtitleGetter);
        hotkeys(shortcut, { capture: useCapture }, handler);
        return () => hotkeys.unbind(shortcut, handler);
    }

    copyHandler<T extends SubtitleModel>(
        onCopy: (event: KeyboardEvent, subtitle: T) => void,
        disabledGetter: () => boolean,
        subtitleGetter: () => T | undefined
    ) {
        return (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return;
            }

            const subtitle = subtitleGetter();

            if (!subtitle) {
                return;
            }

            onCopy(event, subtitle);
        };
    }

    bindAnkiExport(onAnkiExport: (event: KeyboardEvent) => void, disabledGetter: () => boolean, useCapture = false) {
        const shortcut = this.keyBindSet.ankiExport.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = this.ankiExportHandler(onAnkiExport, disabledGetter);
        hotkeys(shortcut, { capture: useCapture }, handler);
        return () => hotkeys.unbind(shortcut, handler);
    }

    ankiExportHandler(onAnkiExport: (event: KeyboardEvent) => void, disabledGetter: () => boolean) {
        return (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return;
            }

            onAnkiExport(event);
        };
    }

    bindUpdateLastCard(
        onUpdateLastCard: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture = false
    ) {
        const shortcut = this.keyBindSet.updateLastCard.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = this.updateLastCardHandler(onUpdateLastCard, disabledGetter);
        hotkeys(shortcut, { capture: useCapture }, handler);
        return () => hotkeys.unbind(shortcut, handler);
    }

    updateLastCardHandler(onUpdateLastCard: (event: KeyboardEvent) => void, disabledGetter: () => boolean) {
        return (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return;
            }

            onUpdateLastCard(event);
        };
    }

    bindSeekToSubtitle(
        onSeekToSubtitle: (event: KeyboardEvent, subtitle: SubtitleModel) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        useCapture = false
    ) {
        const delegate = (event: KeyboardEvent, forward: boolean) => {
            if (disabledGetter()) {
                return;
            }

            const subtitles = subtitlesGetter();

            if (!subtitles || subtitles.length === 0) {
                return;
            }

            const subtitle = this._adjacentSubtitle(forward, timeGetter(), subtitles);

            if (subtitle !== null && subtitle.start >= 0 && subtitle.end >= 0) {
                onSeekToSubtitle(event, subtitle);
            }
        };
        const previousShortcut = this.keyBindSet.seekToPreviousSubtitle.keys;
        const nextShortcut = this.keyBindSet.seekToNextSubtitle.keys;
        const previousHandler = (event: KeyboardEvent) => delegate(event, false);
        const nextHandler = (event: KeyboardEvent) => delegate(event, true);

        if (previousShortcut) {
            hotkeys(previousShortcut, { capture: useCapture }, previousHandler);
        }

        if (nextShortcut) {
            hotkeys(nextShortcut, { capture: useCapture }, nextHandler);
        }

        return () => {
            if (previousShortcut) {
                hotkeys.unbind(previousShortcut, previousHandler);
            }

            if (nextShortcut) {
                hotkeys.unbind(nextShortcut, nextHandler);
            }
        };
    }

    bindSeekToBeginningOfCurrentSubtitle(
        onSeekToBeginningOfCurrentSubtitle: (event: KeyboardEvent, subtitle: SubtitleModel) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        useCapture = false
    ) {
        const shortcut = this.keyBindSet.seekToBeginningOfCurrentSubtitle.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return;
            }

            const subtitles = subtitlesGetter();

            if (!subtitles || subtitles.length === 0) {
                return;
            }

            const subtitle = this._currentSubtitle(timeGetter(), subtitles);

            if (subtitle !== undefined && subtitle.start >= 0 && subtitle.end >= 0) {
                onSeekToBeginningOfCurrentSubtitle(event, subtitle);
            }
        };
        hotkeys(shortcut, { capture: useCapture }, handler);
        return () => hotkeys.unbind(shortcut, handler);
    }

    _currentSubtitle(time: number, subtitles: SubtitleModel[]) {
        const now = time;
        let currentSubtitle: SubtitleModel | undefined;
        let minDiff = Number.MAX_SAFE_INTEGER;

        for (let i = 0; i < subtitles.length; ++i) {
            const s = subtitles[i];

            if (s.start < 0 || s.end < 0) {
                continue;
            }

            const diff = now - s.start;

            if (now >= s.start && now < s.end) {
                if (diff < minDiff) {
                    currentSubtitle = s;
                    minDiff = diff;
                }
            }
        }

        return currentSubtitle;
    }

    bindSeekBackwardOrForward(
        onSeekBackwardOrForward: (event: KeyboardEvent, forward: boolean) => void,
        disabledGetter: () => boolean,
        useCapture = false
    ) {
        const delegate = (event: KeyboardEvent, forward: boolean) => {
            if (disabledGetter()) {
                return;
            }

            onSeekBackwardOrForward(event, forward);
        };
        const backShortcut = this.keyBindSet.seekBackward.keys;
        const nextShortcut = this.keyBindSet.seekForward.keys;
        const backHandler = (event: KeyboardEvent) => delegate(event, false);
        const nextHandler = (event: KeyboardEvent) => delegate(event, true);

        if (backShortcut) {
            hotkeys(backShortcut, { capture: useCapture }, backHandler);
        }

        if (nextShortcut) {
            hotkeys(nextShortcut, { capture: useCapture }, nextHandler);
        }

        return () => {
            if (backShortcut) {
                hotkeys.unbind(backShortcut, backHandler);
            }

            if (nextShortcut) {
                hotkeys.unbind(nextShortcut, nextHandler);
            }
        };
    }

    bindOffsetToSubtitle(
        onOffsetChange: (event: KeyboardEvent, newOffset: number) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        useCapture = false
    ) {
        const delegate = (event: KeyboardEvent, forward: boolean) => {
            if (disabledGetter()) {
                return;
            }

            const subtitles = subtitlesGetter();

            if (!subtitles || subtitles.length === 0) {
                return;
            }

            const time = timeGetter();
            const subtitle = this._adjacentSubtitle(forward, time, subtitles);

            if (subtitle !== null) {
                const subtitleStart = subtitle.originalStart;
                const newOffset = time - subtitleStart;
                onOffsetChange(event, newOffset);
            }
        };
        const previousShortcut = this.keyBindSet.adjustOffsetToPreviousSubtitle.keys;
        const nextShortcut = this.keyBindSet.adjustOffsetToNextSubtitle.keys;
        const previousHandler = (event: KeyboardEvent) => delegate(event, false);
        const nextHandler = (event: KeyboardEvent) => delegate(event, true);

        if (previousShortcut) {
            hotkeys(previousShortcut, { capture: useCapture }, previousHandler);
        }

        if (nextShortcut) {
            hotkeys(nextShortcut, { capture: useCapture }, nextHandler);
        }

        return () => {
            if (previousShortcut) {
                hotkeys.unbind(previousShortcut, previousHandler);
            }

            if (nextShortcut) {
                hotkeys.unbind(nextShortcut, nextHandler);
            }
        };
    }

    _adjacentSubtitle(forward: boolean, time: number, subtitles: SubtitleModel[]) {
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

    bindAdjustOffset(
        onOffsetChange: (event: KeyboardEvent, newOffset: number) => void,
        disabledGetter: () => boolean,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        useCapture = false
    ) {
        const delegate = (event: KeyboardEvent, increase: boolean) => {
            if (disabledGetter()) {
                return;
            }

            const subtitles = subtitlesGetter();

            if (!subtitles || subtitles.length === 0) {
                return;
            }

            const currentOffset = subtitles[0].start - subtitles[0].originalStart;
            const newOffset = currentOffset + (increase ? 100 : -100);
            onOffsetChange(event, newOffset);
        };

        const decreaseShortcut = this.keyBindSet.decreaseOffset.keys;
        const increaseShortcut = this.keyBindSet.increaseOffset.keys;
        const decreaseHandler = (event: KeyboardEvent) => delegate(event, false);
        const increaseHandler = (event: KeyboardEvent) => delegate(event, true);

        hotkeys(decreaseShortcut, { capture: useCapture }, decreaseHandler);
        hotkeys(increaseShortcut, { capture: useCapture }, increaseHandler);
        return () => {
            hotkeys.unbind(decreaseShortcut, decreaseHandler);
            hotkeys.unbind(increaseShortcut, increaseHandler);
        };
    }

    bindResetOffet(
        onResetOffset: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ) {
        const shortcut = this.keyBindSet.resetOffset.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return;
            }

            onResetOffset(event);
        };

        hotkeys(shortcut, { capture: useCapture }, handler);
        return () => {
            hotkeys.unbind(shortcut, handler);
        };
    }

    bindAdjustPlaybackRate(
        onAdjustPlaybackRate: (event: KeyboardEvent, increase: boolean) => void,
        disabledGetter: () => boolean,
        useCapture = false
    ) {
        const delegate = (event: KeyboardEvent, increase: boolean) => {
            if (disabledGetter()) {
                return;
            }

            onAdjustPlaybackRate(event, increase);
        };
        const increaseShortcut = this.keyBindSet.increasePlaybackRate.keys;
        const decreaseShortcut = this.keyBindSet.decreasePlaybackRate.keys;
        const decreaseHandler = (event: KeyboardEvent) => delegate(event, false);
        const increaseHandler = (event: KeyboardEvent) => delegate(event, true);

        if (decreaseShortcut) {
            hotkeys(decreaseShortcut, { capture: useCapture }, decreaseHandler);
        }

        if (increaseShortcut) {
            hotkeys(increaseShortcut, { capture: useCapture }, increaseHandler);
        }

        return () => {
            if (decreaseShortcut) {
                hotkeys.unbind(decreaseShortcut, decreaseHandler);
            }

            if (increaseShortcut) {
                hotkeys.unbind(increaseShortcut, increaseHandler);
            }
        };
    }

    bindToggleSubtitles(
        onToggleSubtitles: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture = false
    ) {
        const shortcut = this.keyBindSet.toggleSubtitles.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return;
            }

            onToggleSubtitles(event);
        };
        hotkeys(shortcut, { capture: useCapture }, handler);
        return () => {
            hotkeys.unbind(shortcut, handler);
        };
    }

    bindToggleSubtitleTrackInVideo(
        onToggleSubtitleTrack: (event: KeyboardEvent, extra: any) => void,
        disabledGetter: () => boolean,
        useCapture = false
    ) {
        const shortcuts = [
            this.keyBindSet.toggleVideoSubtitleTrack1.keys,
            this.keyBindSet.toggleVideoSubtitleTrack2.keys,
        ].filter((s) => s);

        if (shortcuts.length === 0) {
            return () => {};
        }

        const delegate = (event: KeyboardEvent, track: number) => {
            if (disabledGetter()) {
                return;
            }

            onToggleSubtitleTrack(event, track);
        };
        let handlers: ((event: KeyboardEvent) => void)[] = [];

        for (let i = 0; i < shortcuts.length; ++i) {
            const handler = (event: KeyboardEvent) => delegate(event, i);
            handlers.push(handler);
            hotkeys(shortcuts[i], { capture: useCapture }, handler);
        }

        return () => {
            for (let i = 0; i < shortcuts.length; ++i) {
                const handler = handlers[i];
                hotkeys.unbind(shortcuts[i], handler);
            }
        };
    }

    bindToggleSubtitleTrackInList(
        onToggleSubtitleTrackInList: (event: KeyboardEvent, extra: any) => void,
        disabledGetter: () => boolean,
        useCapture = false
    ) {
        const shortcuts = [
            this.keyBindSet.toggleAsbplayerSubtitleTrack1.keys,
            this.keyBindSet.toggleAsbplayerSubtitleTrack2.keys,
        ].filter((s) => s);

        if (shortcuts.length === 0) {
            return () => {};
        }

        const delegate = (event: KeyboardEvent, track: number) => {
            if (disabledGetter()) {
                return;
            }

            onToggleSubtitleTrackInList(event, track);
        };

        let handlers: ((event: KeyboardEvent) => void)[] = [];

        for (let i = 0; i < 9; ++i) {
            const handler = (event: KeyboardEvent) => delegate(event, i);
            handlers.push(handler);
            hotkeys(shortcuts[i], { capture: useCapture }, handler);
        }

        return () => {
            for (let i = 0; i < 9; ++i) {
                const handler = handlers[i];
                hotkeys.unbind(shortcuts[i], handler);
            }
        };
    }

    bindPlay(onPlay: (event: KeyboardEvent) => void, disabledGetter: () => boolean, useCapture = false) {
        const shortcut = this.keyBindSet.togglePlay.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return;
            }

            onPlay(event);
        };

        hotkeys(shortcut, { capture: useCapture }, handler);
        return () => {
            hotkeys.unbind(shortcut, handler);
        };
    }

    bindAutoPause(onAutoPause: (event: KeyboardEvent) => void, disabledGetter: () => boolean, useCapture = false) {
        const shortcut = this.keyBindSet.toggleAutoPause.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return;
            }

            onAutoPause(event);
        };
        hotkeys(shortcut, { capture: useCapture }, handler);
        return () => {
            hotkeys.unbind(shortcut, handler);
        };
    }

    bindCondensedPlayback(
        onAutoPause: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture = false
    ) {
        const shortcut = this.keyBindSet.toggleCondensedPlayback.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return;
            }

            onAutoPause(event);
        };
        hotkeys(shortcut, { capture: useCapture }, handler);
        return () => {
            hotkeys.unbind(shortcut, handler);
        };
    }
}
