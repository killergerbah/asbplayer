import AudioRecorder from '../../services/AudioRecorder';
import ImageCapturer from '../../services/ImageCapturer';
import { v4 as uuidv4 } from 'uuid';
import {
    Command,
    CopyMessage,
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    ImageModel,
    Message,
    ScreenshotTakenMessage,
    ShowAnkiUiMessage,
    StartRecordingMediaMessage,
    SubtitleModel,
    VideoToExtensionCommand,
} from '@project/common';

export default class StartRecordingMediaHandler {
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
        return 'start-recording-media';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const windowActive = await this._isWindowActive(sender.tab!.windowId);

        if (!windowActive) {
            console.error('Received record request from wrong window.');
            return;
        }

        const startRecordingCommand = command as VideoToExtensionCommand<StartRecordingMediaMessage>;

        if (startRecordingCommand.message.record) {
            this.audioRecorder.start();
        }

        let imageBase64 = null;

        if (startRecordingCommand.message.screenshot) {
            imageBase64 = await this.imageCapturer.capture(
                startRecordingCommand.message.rect!,
                startRecordingCommand.message.maxImageWidth,
                startRecordingCommand.message.maxImageHeight
            );
            const screenshotTakenCommand: ExtensionToVideoCommand<ScreenshotTakenMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'screenshot-taken',
                },
                src: startRecordingCommand.src,
            };

            chrome.tabs.sendMessage(sender.tab!.id!, screenshotTakenCommand);
        }

        if (!startRecordingCommand.message.record) {
            const subtitle: SubtitleModel = {
                text: '',
                start: startRecordingCommand.message.timestamp,
                originalStart: startRecordingCommand.message.timestamp,
                end: startRecordingCommand.message.timestamp,
                originalEnd: startRecordingCommand.message.timestamp,
                track: 0,
            };
            const id = uuidv4();

            let image: ImageModel | undefined = undefined;

            if (imageBase64) {
                image = {
                    base64: imageBase64,
                    extension: 'jpeg',
                };
            }

            chrome.tabs.query({}, (allTabs) => {
                const copyCommand: ExtensionToAsbPlayerCommand<CopyMessage> = {
                    sender: 'asbplayer-extension-to-player',
                    message: {
                        command: 'copy',
                        id: id,
                        subtitle: subtitle,
                        surroundingSubtitles: [],
                        image: image,
                        url: startRecordingCommand.message.url,
                    },
                    tabId: sender.tab!.id!,
                    src: startRecordingCommand.src,
                };

                for (let t of allTabs) {
                    chrome.tabs.sendMessage(t.id!, copyCommand);
                }
            });

            if (startRecordingCommand.message.showAnkiUi) {
                const showAnkiUiCommand: ExtensionToVideoCommand<ShowAnkiUiMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'show-anki-ui',
                        id: id,
                        subtitle: subtitle,
                        surroundingSubtitles: [],
                        image: image,
                        url: startRecordingCommand.message.url,
                    },
                    src: startRecordingCommand.src,
                };

                chrome.tabs.sendMessage(sender.tab!.id!, showAnkiUiCommand);
            }
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
