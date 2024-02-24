import ImageCapturer from '../../services/image-capturer';
import {
    Command,
    ExtensionToVideoCommand,
    ImageModel,
    Message,
    ScreenshotTakenMessage,
    StartRecordingMediaMessage,
    SubtitleModel,
    VideoToExtensionCommand,
} from '@project/common';
import BackgroundPageManager from '../../services/background-page-manager';
import { CardPublisher } from '../../services/card-publisher';

export default class StartRecordingMediaHandler {
    private readonly _audioRecorder: BackgroundPageManager;
    private readonly _imageCapturer: ImageCapturer;
    private readonly _cardPublisher: CardPublisher;

    constructor(audioRecorder: BackgroundPageManager, imageCapturer: ImageCapturer, cardPublisher: CardPublisher) {
        this._audioRecorder = audioRecorder;
        this._imageCapturer = imageCapturer;
        this._cardPublisher = cardPublisher;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'start-recording-media';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const startRecordingCommand = command as VideoToExtensionCommand<StartRecordingMediaMessage>;

        if (startRecordingCommand.message.record) {
            this._audioRecorder.start({ src: startRecordingCommand.src, tabId: sender.tab?.id! });
        }

        let imageBase64: string | undefined;

        if (startRecordingCommand.message.screenshot) {
            const imageDelay = startRecordingCommand.message.record ? startRecordingCommand.message.imageDelay : 0;
            const { maxWidth, maxHeight, rect, frameId } = startRecordingCommand.message;
            imageBase64 = await this._imageCapturer.capture(sender.tab!.id!, startRecordingCommand.src, imageDelay, {
                maxWidth,
                maxHeight,
                rect,
                frameId,
            });
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
                start: startRecordingCommand.message.mediaTimestamp,
                originalStart: startRecordingCommand.message.mediaTimestamp,
                end: startRecordingCommand.message.mediaTimestamp,
                originalEnd: startRecordingCommand.message.mediaTimestamp,
                track: 0,
            };

            let imageModel: ImageModel | undefined = undefined;

            if (imageBase64) {
                imageModel = {
                    base64: imageBase64,
                    extension: 'jpeg',
                };
            }

            this._cardPublisher.publish(
                {
                    subtitle: subtitle,
                    surroundingSubtitles: [],
                    image: imageModel,
                    url: startRecordingCommand.message.url,
                    subtitleFileName: startRecordingCommand.message.subtitleFileName,
                    mediaTimestamp: startRecordingCommand.message.mediaTimestamp,
                },
                startRecordingCommand.message.postMineAction,
                sender.tab!.id!,
                startRecordingCommand.src
            );
        }
    }
}
