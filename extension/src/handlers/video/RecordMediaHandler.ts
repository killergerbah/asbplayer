import AudioRecorder from '../../services/AudioRecorder';
import ImageCapturer from '../../services/ImageCapturer';
import { v4 as uuidv4 } from 'uuid';
import {
    AudioModel,
    Command,
    CopyMessage,
    ImageModel,
    Message,
    RecordMediaAndForwardSubtitleMessage,
    ExtensionToAsbPlayerCommand,
    VideoToExtensionCommand,
    ExtensionToVideoCommand,
    ShowAnkiUiMessage,
    ScreenshotTakenMessage,
    PostMineAction,
} from '@project/common';
import updateLastCard from '../../functions/updateLastCard';

export default class RecordMediaHandler {
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
        return 'record-media-and-forward-subtitle';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const senderTab = sender.tab!;
        const windowActive = await this._isWindowActive(senderTab.windowId);

        if (!windowActive) {
            console.error('Received record request from wrong window.');
            return;
        }

        const recordMediaCommand = command as VideoToExtensionCommand<RecordMediaAndForwardSubtitleMessage>;
        const itemId = uuidv4();
        const subtitle = recordMediaCommand.message.subtitle;
        let audioPromise = undefined;
        let imagePromise = undefined;
        let imageModel: ImageModel | undefined = undefined;
        let audioModel: AudioModel | undefined = undefined;

        if (recordMediaCommand.message.record) {
            const time =
                (subtitle.end - subtitle.start) / recordMediaCommand.message.playbackRate +
                recordMediaCommand.message.audioPaddingEnd;
            audioPromise = this.audioRecorder.startWithTimeout(time);
        }

        if (recordMediaCommand.message.screenshot) {
            imagePromise = this.imageCapturer.capture(
                recordMediaCommand.message.rect!,
                recordMediaCommand.message.maxImageWidth,
                recordMediaCommand.message.maxImageHeight
            );
        }

        if (imagePromise) {
            await imagePromise;
            const screenshotTakenCommand: ExtensionToVideoCommand<ScreenshotTakenMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'screenshot-taken',
                },
                src: recordMediaCommand.src,
            };

            chrome.tabs.sendMessage(senderTab.id!, screenshotTakenCommand);
        }

        if (audioPromise) {
            const audioBase64 = await audioPromise;
            audioModel = {
                base64: audioBase64,
                extension: 'webm',
                paddingStart: recordMediaCommand.message.audioPaddingStart,
                paddingEnd: recordMediaCommand.message.audioPaddingEnd,
            };
        }

        if (imagePromise) {
            // Use the last screenshot taken to allow user to re-take screenshot while audio is recording
            imageModel = {
                base64: this.imageCapturer.lastImageBase64!,
                extension: 'jpeg',
            };
        }

        const message: CopyMessage = {
            command: 'copy',
            id: itemId,
            url: recordMediaCommand.message.url,
            subtitle: subtitle,
            surroundingSubtitles: recordMediaCommand.message.surroundingSubtitles,
            image: imageModel,
            audio: audioModel,
        };

        chrome.tabs.query({}, (allTabs) => {
            const copyCommand: ExtensionToAsbPlayerCommand<CopyMessage> = {
                sender: 'asbplayer-extension-to-player',
                message: message,
                tabId: senderTab.id!,
                src: recordMediaCommand.src,
            };

            for (let t of allTabs) {
                if (t.id) {
                    chrome.tabs.sendMessage(t.id, copyCommand);
                }
            }
        });

        if (recordMediaCommand.message.postMineAction == PostMineAction.showAnkiDialog) {
            const showAnkiUiCommand: ExtensionToVideoCommand<ShowAnkiUiMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'show-anki-ui',
                    id: itemId,
                    subtitle: message.subtitle,
                    surroundingSubtitles: message.surroundingSubtitles,
                    image: message.image,
                    audio: message.audio,
                    url: message.url,
                },
                src: recordMediaCommand.src,
            };

            chrome.tabs.sendMessage(senderTab.id!, showAnkiUiCommand);
        } else if (recordMediaCommand.message.postMineAction == PostMineAction.updateLastCard) {
            if (!recordMediaCommand.message.ankiSettings) {
                throw new Error('Cannot update last card because anki settings is undefined');
            }

            updateLastCard(
                recordMediaCommand.message.ankiSettings,
                subtitle,
                audioModel,
                imageModel,
                recordMediaCommand.message.sourceString,
                recordMediaCommand.message.url
            );
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
