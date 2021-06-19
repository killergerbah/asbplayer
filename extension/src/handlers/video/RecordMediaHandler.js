import AudioRecorder from '../../services/AudioRecorder';
import ImageCapturer from '../../services/ImageCapturer';

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
        const subtitle = request.message.subtitle;
        const message = {
            command: 'copy',
            subtitle: subtitle
        };

        let audioPromise = null;
        let imagePromise = null;

        if (request.message.record) {
            const time = subtitle.end - subtitle.start + 500;
            audioPromise = this.audioRecorder.record(time);
        }

        if (request.message.screenshot) {
            imagePromise = this.imageCapturer.capture(request.message.rect);
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
                extension: 'webm'
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
    }
}