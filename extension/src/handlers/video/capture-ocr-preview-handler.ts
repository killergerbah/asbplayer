import type ImageCapturer from '@project/extension/src/services/image-capturer';
import type { CaptureOcrPreviewMessage, Command, Message, VideoToExtensionCommand } from '@project/common';

/** Captures a cropped video frame before the subtitle selector masks the page. */
export default class CaptureOcrPreviewHandler {
    constructor(private readonly _imageCapturer: ImageCapturer) {}

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'capture-ocr-preview';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const request = command as VideoToExtensionCommand<CaptureOcrPreviewMessage>;
        if (sender.tab?.id === undefined) {
            sendResponse({ error: 'Cannot capture a video preview without an active browser tab.' });
            return;
        }
        void this._imageCapturer
            .captureVideoPreview(sender.tab.id, request.src, request.message)
            .then((dataUrl) => sendResponse({ dataUrl }))
            .catch(() =>
                sendResponse({
                    error: 'Could not capture the current video frame. Pause the video and reopen Select Subtitles.',
                })
            );
        return true;
    }
}
