import {
    MobileOverlayToVideoCommand,
    MobileOverlayModel,
    RequestMobileOverlayModelMessage,
    VideoToMobileOverlayCommand,
    UpdateMobileOverlayModelMessage,
} from '@project/common';
import Binding from '../services/binding';
import { CachingElementOverlay, ElementOverlay, OffsetAnchor } from '../services/element-overlay';
import { adjacentSubtitle } from '@project/common/key-binder';

export class MobileVideoOverlayController {
    private readonly _context: Binding;
    private readonly _overlay: ElementOverlay;
    private _pauseListener?: () => void;
    private _playListener?: () => void;
    private _forceHiding: boolean = false;
    private _showing: boolean = false;
    private _tabId?: number;
    private _messageListener?: (
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => void;
    private _bound = false;

    constructor(context: Binding) {
        this._context = context;
        this._overlay = new CachingElementOverlay({
            targetElement: this._context.video,
            nonFullscreenContainerClassName: 'asbplayer-mobile-video-overlay-container',
            fullscreenContainerClassName: 'asbplayer-mobile-video-overlay-container',
            nonFullscreenContentClassName: 'asbplayer-mobile-video-overlay',
            fullscreenContentClassName: 'asbplayer-mobile-video-overlay',
            offsetAnchor: OffsetAnchor.top,
            contentPositionOffset: 8,
        });
    }

    set forceHide(forceHide: boolean) {
        if (forceHide) {
            if (this._showing) {
                this._forceHiding = true;
                this._hide();
            }
        } else {
            if (this._forceHiding) {
                this._forceHiding = false;
                this._show();
            }
        }
    }

    bind() {
        if (this._bound) {
            return;
        }

        this._pauseListener = () => {
            if (!this._context.synced || this._forceHiding) {
                return;
            }

            this._show();
        };
        this._playListener = () => {
            if (!this._context.synced || this._context.recordingMedia) {
                return;
            }

            this._hide();
        };

        this._context.video.addEventListener('pause', this._pauseListener);
        this._context.video.addEventListener('play', this._playListener);
        this._messageListener = (
            message: any,
            sender: chrome.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            if (
                message.sender === 'asbplayer-mobile-overlay-to-video' &&
                message.message.command === 'request-mobile-overlay-model'
            ) {
                const command = message as MobileOverlayToVideoCommand<RequestMobileOverlayModelMessage>;
                this._tabId = command.message.tabId;

                if (command.src === this._context.video.src) {
                    this._model().then(sendResponse);
                    return true;
                }
            }
        };
        chrome.runtime.onMessage.addListener(this._messageListener);
        this._bound = true;
    }

    async updateModel() {
        if (this._tabId === undefined) {
            return;
        }

        const model = await this._model();
        const command: VideoToMobileOverlayCommand<UpdateMobileOverlayModelMessage> = {
            sender: 'asbplayer-video-to-mobile-overlay',
            message: {
                command: 'update-mobile-overlay-model',
                model,
            },
            src: this._context.video.src,
        };
        chrome.runtime.sendMessage(command);
    }

    private async _model() {
        const subtitles = this._context.subtitleController.subtitles;
        const timestamp = this._context.video.currentTime * 1000;
        const { language, clickToMineDefaultAction } = await this._context.settings.get([
            'language',
            'clickToMineDefaultAction',
        ]);
        const model: MobileOverlayModel = {
            offset: subtitles.length === 0 ? 0 : subtitles[0].start - subtitles[0].originalStart,
            emptySubtitleTrack: subtitles.length === 0,
            recordingEnabled: this._context.recordMedia,
            recording: this._context.recordingMedia,
            previousSubtitleTimestamp: adjacentSubtitle(false, timestamp, subtitles)?.originalStart ?? undefined,
            nextSubtitleTimestamp: adjacentSubtitle(true, timestamp, subtitles)?.originalStart ?? undefined,
            currentTimestamp: timestamp,
            language,
            postMineAction: clickToMineDefaultAction,
        };
        return model;
    }

    private _show() {
        this._overlay.setHtml([
            {
                key: 'ui',
                html: () =>
                    `<iframe src="${chrome.runtime.getURL('mobile-video-overlay-ui.html')}?src=${encodeURIComponent(
                        this._context.video.src
                    )}"/>`,
            },
        ]);
        this._showing = true;
    }

    private _hide() {
        this._overlay.hide();
        this._showing = false;
    }

    unbind() {
        if (this._pauseListener) {
            this._context.video.removeEventListener('pause', this._pauseListener);
            this._pauseListener = undefined;
        }

        if (this._playListener) {
            this._context.video.removeEventListener('play', this._playListener);
            this._playListener = undefined;
        }

        if (this._messageListener) {
            chrome.runtime.onMessage.removeListener(this._messageListener);
            this._messageListener = undefined;
        }
    }
}
