import AudioRecorder from '../../services/AudioRecorder';
import ImageCapturer from '../../services/ImageCapturer';
import { v4 as uuidv4 } from 'uuid';
import { mockSurroundingSubtitles } from '@project/common';

export default class StopRecordingMediaHandler {

    constructor(audioRecorder, imageCapturer) {
        this.audioRecorder = audioRecorder;
        this.imageCapturer = imageCapturer;
        this.recording = false;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'stop-recording-media';
    }

    async handle(request, sender) {
        const windowActive = await this._isWindowActive(sender.tab.windowId);

        if (!windowActive) {
            console.error("Received record request from wrong window.");
            return;
        }

        const itemId = uuidv4();
        const subtitle = {text: '', start: request.message.startTimestamp, end: request.message.endTimestamp, track: 0};
        const surroundingSubtitles = mockSurroundingSubtitles(
            subtitle,
            request.message.videoDuration,
            5000
        );
        const message = {
            command: 'copy',
            id: itemId,
            subtitle: subtitle,
            surroundingSubtitles: surroundingSubtitles
        };

        if (request.message.screenshot && this.imageCapturer.lastImageBase64) {
            message['image'] = {
                base64: this.imageCapturer.lastImageBase64,
                extension: 'jpeg'
            };
        }

        const audioBase64 = await this.audioRecorder.stop();
        message['audio'] = {
            base64: audioBase64,
            extension: 'webm',
            paddingStart: 0,
            paddingEnd: 0,
            start: request.message.startTimestamp,
            end: request.message.endTimestamp
        };

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
                    subtitle: subtitle,
                    surroundingSubtitles: surroundingSubtitles,
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