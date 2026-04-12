import { CachingElementOverlay, OffsetAnchor } from '@/services/element-overlay';
import { frameColorScheme } from '@/services/frame-color-scheme';
import {
    CloseStatisticsOverlayMessage,
    Command,
    Message,
    OpenStatisticsOverlayMessage,
    ResizeStatisticsOverlayMessage,
    StatisticsOverlayToTabCommand,
} from '@project/common';

type State = 'open' | 'fullscreen' | 'closed';

export class StatisticsOverlayController {
    private _messageListener?: (
        message: any,
        sender: Browser.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => void;
    private _overlay?: CachingElementOverlay;
    private _height?: string;
    private _restoreWidth?: string;
    private _width?: string;
    private _state: State = 'closed';
    private _restoreTimeout?: NodeJS.Timeout;
    private _lastClosedMediaId?: string;

    unbind() {
        if (this._messageListener !== undefined) {
            browser.runtime.onMessage.removeListener(this._messageListener);
            this._messageListener = undefined;
        }
        if (this._restoreTimeout !== undefined) {
            clearTimeout(this._restoreTimeout);
        }
        this._overlay?.dispose();
        this._overlay = undefined;
    }

    bind() {
        this._messageListener = (
            message: any,
            sender: Browser.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            if (message.sender === 'asbplayer-statistics-overlay-to-tab') {
                this._handleMessageFromOverlay(message);
            } else {
                this._handleMessage(message);
            }
        };
        this._ensureOverlay();
        browser.runtime.onMessage.addListener(this._messageListener);
    }

    private _handleMessageFromOverlay(message: any) {
        const command = message as StatisticsOverlayToTabCommand<Message>;

        switch (command.message.command) {
            case 'fullscreen-statistics-overlay':
                if (this._state !== 'fullscreen') {
                    this._state = 'fullscreen';
                    this._setHeight('100vh');
                    this._restoreWidth = this._width;
                    this._setWidth('100vw');
                }
                break;
            case 'restore-statistics-overlay':
                // Hack: delay to let sentence dialog animate closed
                if (this._restoreTimeout !== undefined) {
                    clearTimeout(this._restoreTimeout);
                }
                this._restoreTimeout = setTimeout(() => {
                    if (this._state === 'fullscreen') {
                        this._state = 'open';
                        this._setHeight('68px');
                        this._setWidth(this._restoreWidth ?? '100%');
                    }
                }, 500);
                break;
            case 'open-statistics-overlay':
                const openMessage = command.message as OpenStatisticsOverlayMessage;
                if (
                    this._state === 'closed' &&
                    (openMessage.force || this._lastClosedMediaId !== openMessage.mediaId)
                ) {
                    this._state = 'open';
                    this._setHeight('68px');
                }
                break;
            case 'close-statistics-overlay':
                const closeMessage = command.message as CloseStatisticsOverlayMessage;
                if (this._state !== 'closed') {
                    this._state = 'closed';
                    this._setHeight('0px');
                    this._lastClosedMediaId = closeMessage.mediaId;
                }
                break;
            case 'resize-statistics-overlay':
                const resizeMessage = command.message as ResizeStatisticsOverlayMessage;
                this._setWidth(`${resizeMessage.width + 50}px`);
                break;
        }
    }

    private _handleMessage(message: any) {
        const command = message as Command<Message>;
        if (command.message.command === 'open-statistics-overlay') {
            const openMessage = (command as Command<OpenStatisticsOverlayMessage>).message;
            if (this._state === 'closed' && (openMessage.force || this._lastClosedMediaId !== openMessage.mediaId)) {
                this._state = 'open';
                this._setHeight('68px');
            }
        }
    }

    private _setHeight(height: string) {
        this._height = height;
        if (this._overlay !== undefined) {
            for (const elm of this._overlay.displayingElements()) {
                (elm as HTMLIFrameElement).style.setProperty('height', height, 'important');
            }
            this._overlay.refresh();
        }
    }

    private _setWidth(width: string) {
        this._width = width;
        if (this._overlay !== undefined) {
            for (const elm of this._overlay.displayingElements()) {
                (elm as HTMLIFrameElement).style.setProperty('width', width, 'important');
            }
            this._overlay.refresh();
        }
    }

    private _ensureOverlay() {
        if (this._overlay !== undefined) {
            return;
        }
        this._overlay = new CachingElementOverlay({
            targetElement: document.body,
            nonFullscreenContainerClassName: 'asbplayer-statistics-overlay-container',
            nonFullscreenContentClassName: '',
            fullscreenContainerClassName: 'asbplayer-statistics-overlay-container',
            fullscreenContentClassName: '',
            offsetAnchor: OffsetAnchor.bottom,
            contentWidthPercentage: -1,
            onMouseOut: () => {},
            onMouseOver: () => {},
            onContainerStyles: (container) => {
                container.style.setProperty('height', this._height ?? null, 'important');
                container.style.setProperty('width', this._width ?? '100%', 'important');
            },
        });
        const colorScheme = frameColorScheme();
        this._overlay.setHtml([
            {
                key: 'ui',
                html: () =>
                    `<iframe style="border: 0 !important; color-scheme: ${colorScheme} !important; width: 100% !important; height: 0px !important" src="${browser.runtime.getURL(
                        '/statistics-overlay-ui.html'
                    )}"/>`,
            },
        ]);
    }
}
