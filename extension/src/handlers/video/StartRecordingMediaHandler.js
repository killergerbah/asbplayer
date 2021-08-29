import AudioRecorder from '../../services/AudioRecorder';
import ImageCapturer from '../../services/ImageCapturer';
import { v4 as uuidv4 } from 'uuid';

export default class StartRecordingMediaHandler {

    constructor(audioRecorder, imageCapturer) {
        this.audioRecorder = audioRecorder;
        this.imageCapturer = imageCapturer;
        this.recording = false;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'start-recording-media';
    }

    async handle(request, sender) {
        const windowActive = await this._isWindowActive(sender.tab.windowId);

        if (!windowActive) {
            console.error("Received record request from wrong window.");
            return;
        }

        if (request.message.record) {
            this.audioRecorder.start();
        }

        let imageBase64 = null;

        if (request.message.screenshot) {
            imageBase64 = await this.imageCapturer.capture(request.message.rect, request.message.maxImageWidth, request.message.maxImageHeight);
            chrome.tabs.sendMessage(sender.tab.id, {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'screenshot-taken'
                },
                src: request.src
            });
        }

        if (!request.message.record) {
            if (imageBase64) {
                message['image'] = {
                    base64: imageBase64,
                    extension: 'jpeg'
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
                        id: uuidv4(),
                        subtitle: {text: '', start: request.message.timestamp, end: request.message.timestamp, track: 0},
                        surroundingSubtitles: [],
                        image: message.image,
                        audio: message.audio,
                    },
                    src: request.src
                });
            }
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