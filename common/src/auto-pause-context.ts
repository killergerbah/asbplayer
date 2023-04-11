import { SubtitleModel } from './model';

export default class AutoPauseContext {
    private lastStartedShowing?: SubtitleModel;
    private lastWillStopShowing?: SubtitleModel;

    onStartedShowing?: () => void;
    onWillStopShowing?: () => void;
    onNextToShow?: (subtitle: SubtitleModel) => void;

    willStopShowing(subtitle: SubtitleModel) {
        if (subtitle.end === this.lastWillStopShowing?.end) {
            return;
        }

        this.onWillStopShowing?.();
        this.lastWillStopShowing = subtitle;
    }

    startedShowing(subtitle: SubtitleModel) {
        if (subtitle.start === this.lastStartedShowing?.start) {
            return;
        }

        this.onStartedShowing?.();
        this.lastStartedShowing = subtitle;
    }

    clear() {
        this.lastStartedShowing = undefined;
        this.lastWillStopShowing = undefined;
    }
}
