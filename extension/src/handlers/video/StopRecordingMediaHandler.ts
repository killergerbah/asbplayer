import AudioRecorder from '../../services/AudioRecorder';
import ImageCapturer from '../../services/ImageCapturer';
import { v4 as uuidv4 } from 'uuid';
import {
    AudioModel,
    Command,
    CopyMessage,
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    ImageModel,
    Message,
    mockSurroundingSubtitles,
    ShowAnkiUiMessage,
    StopRecordingMediaMessage,
    SubtitleModel,
    VideoToExtensionCommand,
} from '@project/common';

export default class StopRecordingMediaHandler {
    private readonly audioRecorder: AudioRecorder;
    private readonly imageCapturer: ImageCapturer;

    constructor(audioRecorder: AudioRecorder, imageCapturer: ImageCapturer) {
        this.audioRecorder = audioRecorder;
        this.imageCapturer = imageCapturer;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'stop-recording-media';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const windowActive = await this._isWindowActive(sender.tab!.windowId);

        if (!windowActive) {
            console.error('Received record request from wrong window.');
            return;
        }

        const stopRecordingCommand = command as VideoToExtensionCommand<StopRecordingMediaMessage>;

        const itemId = uuidv4();
        const subtitle: SubtitleModel = {
            text: '',
            start: stopRecordingCommand.message.startTimestamp,
            end: stopRecordingCommand.message.endTimestamp,
            originalStart: stopRecordingCommand.message.startTimestamp,
            originalEnd: stopRecordingCommand.message.startTimestamp,
            track: 0,
        };
        const surroundingSubtitles = mockSurroundingSubtitles(
            subtitle,
            stopRecordingCommand.message.videoDuration,
            5000
        );

        let image: ImageModel | undefined = undefined;

        if (stopRecordingCommand.message.screenshot && this.imageCapturer.lastImageBase64) {
            image = {
                base64: this.imageCapturer.lastImageBase64,
                extension: 'jpeg',
            };
        }

        const audioBase64 = await this.audioRecorder.stop();
        const audio: AudioModel = {
            base64: audioBase64,
            extension: 'webm',
            paddingStart: 0,
            paddingEnd: 0,
            start: stopRecordingCommand.message.startTimestamp,
            end: stopRecordingCommand.message.endTimestamp,
        };

        chrome.tabs.query({}, (allTabs) => {
            const copyCommand: ExtensionToAsbPlayerCommand<CopyMessage> = {
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'copy',
                    id: itemId,
                    subtitle: subtitle,
                    surroundingSubtitles: surroundingSubtitles,
                    image: image,
                    audio: audio,
                    url: stopRecordingCommand.message.url,
                },
                tabId: sender.tab!.id!,
                src: stopRecordingCommand.src,
            };

            for (let t of allTabs) {
                chrome.tabs.sendMessage(t.id!, copyCommand);
            }
        });

        if (stopRecordingCommand.message.showAnkiUi) {
            const showAnkiUiCommand: ExtensionToVideoCommand<ShowAnkiUiMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'show-anki-ui',
                    id: itemId,
                    subtitle: subtitle,
                    surroundingSubtitles: surroundingSubtitles,
                    image: image,
                    audio: audio,
                    url: stopRecordingCommand.message.url,
                },
                src: stopRecordingCommand.src,
            };

            chrome.tabs.sendMessage(sender.tab!.id!, showAnkiUiCommand);
        }
    }

    async _isWindowActive(windowId: number) {
        return new Promise((resolve, reject) => {
            chrome.windows.getLastFocused((window) => {
                resolve(window.id === windowId);
            });
        });
    }
}
