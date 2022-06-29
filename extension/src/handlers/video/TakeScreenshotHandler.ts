import ImageCapturer from '../../services/ImageCapturer';
import {
    Command,
    Message,
    VideoToExtensionCommand,
    ExtensionToVideoCommand,
    ScreenshotTakenMessage,
    TakeScreenshotFromExtensionMessage,
} from '@project/common';

export default class TakeScreenshotHandler {
    private readonly imageCapturer: ImageCapturer;

    constructor(imageCapturer: ImageCapturer) {
        this.imageCapturer = imageCapturer;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'take-screenshot';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const senderTab = sender.tab!;
        const windowActive = await this._isWindowActive(senderTab.windowId);

        if (!windowActive) {
            console.error('Received screenshot request from wrong window.');
            return;
        }

        const takeScreenshotCommand = command as VideoToExtensionCommand<TakeScreenshotFromExtensionMessage>;

        await this.imageCapturer.capture(
            takeScreenshotCommand.message.rect,
            takeScreenshotCommand.message.maxImageWidth,
            takeScreenshotCommand.message.maxImageHeight
        );

        const screenshotTakenCommand: ExtensionToVideoCommand<ScreenshotTakenMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'screenshot-taken',
                image: {
                    base64: this.imageCapturer.lastImageBase64!,
                    extension: 'jpeg',
                },
            },
            src: takeScreenshotCommand.src,
        };

        chrome.tabs.sendMessage(senderTab.id!, screenshotTakenCommand);
    }

    async _isWindowActive(windowId: number) {
        return new Promise((resolve, reject) => {
            chrome.windows.getLastFocused((window) => {
                resolve(window.id === windowId);
            });
        });
    }
}
