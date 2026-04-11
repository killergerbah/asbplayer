import { CachingElementOverlay, OffsetAnchor } from '@/services/element-overlay';
import { frameColorScheme } from '@/services/frame-color-scheme';
import { Message, StatisticsOverlayToTabCommand } from '@project/common';

type State = 'open' | 'fullscreen' | 'closed';

export class StatisticsOverlayController {
    private _messageListener?: (
        message: any,
        sender: Browser.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => void;
    private _overlay?: CachingElementOverlay;
    private _height?: string;
    private _state: State = 'closed';
    private _restoreTimeout?: NodeJS.Timeout;

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
            if (message.sender !== 'asbplayer-statistics-overlay-to-tab') {
                return;
            }

            const command = message as StatisticsOverlayToTabCommand<Message>;

            switch (command.message.command) {
                case 'fullscreen':
                    if (this._state !== 'fullscreen') {
                        this._state = 'fullscreen';
                        this._setHeight('100vh');
                    }
                    break;
                case 'restore':
                    // Hack: delay to let sentence dialog animate closed
                    if (this._restoreTimeout !== undefined) {
                        clearTimeout(this._restoreTimeout);
                    }
                    this._restoreTimeout = setTimeout(() => {
                        if (this._state === 'fullscreen') {
                            this._state = 'open';
                            this._setHeight('68px');
                        }
                    }, 500);
                    break;
                case 'open':
                    if (this._state === 'closed') {
                        this._state = 'open';
                        this._setHeight('68px');
                    }
                    break;
                case 'close':
                    if (this._state !== 'closed') {
                        this._state = 'closed';
                        this._setHeight('0px');
                    }
                    break;
            }
        };
        this._ensureOverlay();
        browser.runtime.onMessage.addListener(this._messageListener);
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
