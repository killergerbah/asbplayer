import ImageCapturer from '../../services/image-capturer';
import {
    AudioModel,
    Command,
    ImageModel,
    Message,
    RecordMediaAndForwardSubtitleMessage,
    VideoToExtensionCommand,
    ExtensionToVideoCommand,
    ScreenshotTakenMessage,
    RecordingFinishedMessage,
    CardModel,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import BackgroundPageManager from '../../services/background-page-manager';
import { CardPublisher } from '../../services/card-publisher';

export default class RecordMediaHandler {
    private readonly _audioRecorder: BackgroundPageManager;
    private readonly _imageCapturer: ImageCapturer;
    private readonly _cardPublisher: CardPublisher;
    private readonly _settingsProvider: SettingsProvider;

    constructor(
        audioRecorder: BackgroundPageManager,
        imageCapturer: ImageCapturer,
        cardPublisher: CardPublisher,
        settingsProvider: SettingsProvider
    ) {
        this._audioRecorder = audioRecorder;
        this._imageCapturer = imageCapturer;
        this._cardPublisher = cardPublisher;
        this._settingsProvider = settingsProvider;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'record-media-and-forward-subtitle';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const senderTab = sender.tab!;
        const recordMediaCommand = command as VideoToExtensionCommand<RecordMediaAndForwardSubtitleMessage>;

        try {
            const subtitle = recordMediaCommand.message.subtitle;
            let audioPromise = undefined;
            let imagePromise = undefined;
            let imageModel: ImageModel | undefined = undefined;
            let audioModel: AudioModel | undefined = undefined;
            const preferMp3 = await this._settingsProvider.getSingle('preferMp3');

            if (recordMediaCommand.message.record) {
                const time =
                    (subtitle.end - subtitle.start) / recordMediaCommand.message.playbackRate +
                    recordMediaCommand.message.audioPaddingEnd;
                audioPromise = this._audioRecorder.startWithTimeout(time, preferMp3, {
                    src: recordMediaCommand.src,
                    tabId: sender.tab?.id!,
                });
            }

            if (recordMediaCommand.message.screenshot) {
                const { maxWidth, maxHeight, rect, frameId } = recordMediaCommand.message;
                imagePromise = this._imageCapturer.capture(
                    senderTab.id!,
                    recordMediaCommand.src,
                    Math.min(subtitle.end - subtitle.start, recordMediaCommand.message.imageDelay),
                    { maxWidth, maxHeight, rect, frameId }
                );
            }

            let imageBase64: string | undefined;

            if (imagePromise) {
                imageBase64 = await imagePromise;
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
                    extension: preferMp3 ? 'mp3' : 'webm',
                    paddingStart: recordMediaCommand.message.audioPaddingStart,
                    paddingEnd: recordMediaCommand.message.audioPaddingEnd,
                    playbackRate: recordMediaCommand.message.playbackRate,
                };
            }

            if (imagePromise) {
                // Use the last screenshot taken to allow user to re-take screenshot while audio is recording
                imageModel = {
                    base64: imageBase64!,
                    extension: 'jpeg',
                };
            }

            const card: CardModel = {
                image: imageModel,
                audio: audioModel,
                ...recordMediaCommand.message,
            };
            this._cardPublisher.publish(
                card,
                recordMediaCommand.message.postMineAction,
                senderTab.id!,
                recordMediaCommand.src
            );
        } finally {
            if (recordMediaCommand.message.record) {
                const recordingFinishedCommand: ExtensionToVideoCommand<RecordingFinishedMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'recording-finished',
                    },
                    src: recordMediaCommand.src,
                };
                chrome.tabs.sendMessage(senderTab.id!, recordingFinishedCommand);
            }
        }
    }
}
