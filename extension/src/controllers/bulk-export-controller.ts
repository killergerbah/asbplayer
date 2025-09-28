import {
    AsbPlayerToVideoCommandV2,
    CardExportedMessage,
    CopySubtitleMessage,
    Message,
    PostMineAction,
    RequestCurrentSubtitleMessage,
    RequestCurrentSubtitleResponse,
} from '@project/common';
import { surroundingSubtitlesAroundInterval } from '@project/common/util';
import Binding from '../services/binding';

interface BulkExportStartedPayload extends Message {
    command: 'bulk-export-started';
    total: number;
}

interface BulkExportCompletedPayload extends Message {
    command: 'bulk-export-completed';
}

interface BulkExportCancelledPayload extends Message {
    command: 'bulk-export-cancelled';
}

export default class BulkExportController {
    private readonly _context: Binding;
    private _exporting = false;
    private _cancelled = false;
    private _queue: number[] = [];
    private _currentIndex = 0;
    private _inFlight = false;
    private _listener?: (
        message: any,
        sender: Browser.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => void;

    constructor(context: Binding) {
        this._context = context;
    }

    bind() {
        if (this._listener) {
            return;
        }

        this._listener = (request: any) => {
            if (!this._exporting || this._cancelled) {
                return false;
            }

            if (
                request?.sender === 'asbplayer-extension-to-video' &&
                request.message &&
                request.message.command === 'card-exported' &&
                request.src === this._context.video.src
            ) {
                const exported = request.message as CardExportedMessage;
                const isBulk = exported.isBulkExport;
                if (!isBulk) {
                    return false;
                }

                this._inFlight = false;
                this._currentIndex++;
                this._notifyProgress();
                this._sendNext();
            }

            return false;
        };

        browser.runtime.onMessage.addListener(this._listener);
    }

    unbind() {
        if (this._listener) {
            browser.runtime.onMessage.removeListener(this._listener);
            this._listener = undefined;
        }
    }

    async start() {
        if (this._exporting) {
            return;
        }

        const subtitles = this._context.subtitleController.subtitles;
        if (!subtitles || subtitles.length === 0) {
            return;
        }

        // Compute queue: all non-empty subtitle indices
        const subtitleIndices = subtitles
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => s.text !== '')
            .map(({ i }) => i);

        if (subtitleIndices.length === 0) {
            return;
        }

        // Determine start index using the current subtitle
        const [currentSubtitle] = this._context.subtitleController.currentSubtitle();
        let startQueueIndex = 0;
        if (currentSubtitle) {
            const currentIdx = subtitles.findIndex(
                (s) => s.start === currentSubtitle.start && s.end === currentSubtitle.end && s.text === currentSubtitle.text
            );
            if (currentIdx >= 0) {
                const found = subtitleIndices.findIndex((i) => i >= currentIdx);
                startQueueIndex = found >= 0 ? found : 0;
            }
        }

        this._queue = startQueueIndex > 0 ? subtitleIndices.slice(startQueueIndex) : subtitleIndices;
        this._currentIndex = 0;
        this._exporting = true;
        this._cancelled = false;
        this._inFlight = false;

        // Inform background (for CardPublisher state) and any UIs (e.g. SidePanel) about start and total
        const startedMessage: AsbPlayerToVideoCommandV2<BulkExportStartedPayload> = {
            sender: 'asbplayerv2',
            message: {
                command: 'bulk-export-started',
                total: this._queue.length,
            },
            tabId: undefined as any,
            src: this._context.video.src,
        };
        try {
            await browser.runtime.sendMessage(startedMessage);
        } catch {}

        // Initial indicator on the video
        this._notifyProgress();

        // Kick off first item
        this._sendNext();
    }

    async cancel() {
        if (!this._exporting || this._cancelled) {
            return;
        }

        this._cancelled = true;
        this._exporting = false;
        this._queue = [];
        this._currentIndex = 0;
        this._inFlight = false;

        // Pause video to stop any ongoing recording
        this._context.pause();

        const cancelledMessage: AsbPlayerToVideoCommandV2<BulkExportCancelledPayload> = {
            sender: 'asbplayerv2',
            message: {
                command: 'bulk-export-cancelled',
            },
            tabId: undefined as any,
            src: this._context.video.src,
        };
        try {
            await browser.runtime.sendMessage(cancelledMessage);
        } catch {}
    }

    private _sendNext() {
        if (this._inFlight || !this._exporting || this._cancelled) {
            return;
        }

        if (this._currentIndex >= this._queue.length) {
            this._complete();
            return;
        }

        const subtitles = this._context.subtitleController.subtitles;
        if (!subtitles || subtitles.length === 0) {
            this._complete();
            return;
        }

        const nextSubtitle = subtitles[this._queue[this._currentIndex]];
        const around = surroundingSubtitlesAroundInterval(
            subtitles,
            nextSubtitle.start,
            nextSubtitle.end,
            this._context.subtitleController.surroundingSubtitlesCountRadius,
            this._context.subtitleController.surroundingSubtitlesTimeRadius
        );
        const surroundingSubtitles = Array.isArray(around.surroundingSubtitles) && around.surroundingSubtitles.length > 0
            ? around.surroundingSubtitles
            : [nextSubtitle];

        const copyMsg: CopySubtitleMessage = {
            command: 'copy-subtitle',
            subtitle: nextSubtitle,
            surroundingSubtitles,
            postMineAction: PostMineAction.exportCard,
            exportMode: 'bulk',
        } as any;

        this._inFlight = true;
        // Use Binding public wrapper to trigger the record-and-forward flow
        this._context.copySubtitleForBulk(copyMsg).catch(() => {
            this._inFlight = false;
        });
    }

    private async _complete() {
        if (!this._exporting) {
            return;
        }
        this._exporting = false;
        this._cancelled = false;
        this._queue = [];
        this._currentIndex = 0;
        this._inFlight = false;

        const completedMessage: AsbPlayerToVideoCommandV2<BulkExportCompletedPayload> = {
            sender: 'asbplayerv2',
            message: {
                command: 'bulk-export-completed',
            },
            tabId: undefined as any,
            src: this._context.video.src,
        };
        try {
            await browser.runtime.sendMessage(completedMessage);
        } catch {}
    }

    private _notifyProgress() {
        if (!this._exporting) {
            return;
        }
        const total = this._queue.length;
        const current = Math.min(this._currentIndex, total);
        // Reuse an existing info notification key to show something on screen
        this._context.subtitleController.notification('info.exportedCard', {
            result: `${current}/${total}`,
        });
    }
}


