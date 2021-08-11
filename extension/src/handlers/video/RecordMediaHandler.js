import AudioRecorder from '../../services/AudioRecorder';
import ImageCapturer from '../../services/ImageCapturer';
import { v4 as uuidv4 } from 'uuid';

export default class RecordMediaHandler {

    constructor(audioRecorder, imageCapturer) {
        this.audioRecorder = audioRecorder;
        this.imageCapturer = imageCapturer;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'record-media-and-forward-subtitle';
    }

    async handle(request, sender) {
        const windowActive = await this._isWindowActive(sender.tab.windowId);

        if (!windowActive) {
            console.error("Received record request from wrong window.");
            return;
        }

        const itemId = uuidv4();
        const subtitle = request.message.subtitle;
        const message = {
            command: 'copy',
            id: itemId,
            subtitle: subtitle,
            surroundingSubtitles: request.message.surroundingSubtitles
        };

        let audioPromise = null;
        let imagePromise = null;

        if (request.message.record) {
            const time = subtitle.end - subtitle.start + request.message.audioPaddingEnd;
            audioPromise = this.audioRecorder.record(time);
        }

        if (request.message.screenshot) {
            imagePromise = this.imageCapturer.capture(request.message.rect, request.message.maxImageWidth, request.message.maxImageHeight);
        }

        if (imagePromise) {
            const imageBase64 = await imagePromise;
            message['image'] = {
                base64: imageBase64,
                extension: 'jpeg'
            };
            chrome.tabs.sendMessage(sender.tab.id, {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'screenshot-taken'
                },
                src: request.src
            });
        }

        if (audioPromise) {
            const audioBase64 = await audioPromise;
            message['audio'] = {
                base64: audioBase64,
                extension: 'webm',
                paddingStart: request.message.audioPaddingStart,
                paddingEnd: request.message.audioPaddingEnd
            };
        }

        chrome.tabs.query({}, (allTabs) => {
            for (let t of allTabs) {
                chrome.tabs.sendMessage(t.id, {
                    sender: 'asbplayer-extension-to-player',
                    message: message,
                    tabId: sender.tab.id,
                    src: request.src
                });
            }
        });

        if (request.message.showAnkiUi) {
            chrome.tabs.sendMessage(sender.tab.id, {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'show-anki-ui',
                    id: itemId,
                    subtitle: message.subtitle,
                    surroundingSubtitles: message.surroundingSubtitles,
                    image: message.image,
                    audio: message.audio,
                },
                src: request.src
            });
        }
    }

    async _isWindowActive(windowId) {
        return new Promise((resolve, reject) => {
            chrome.windows.getLastFocused(null, (window) => {
                resolve(window.id === windowId);
            });
        });
    }
}