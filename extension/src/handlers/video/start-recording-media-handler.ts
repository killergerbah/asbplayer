import ImageCapturer from '../../services/image-capturer';
import { v4 as uuidv4 } from 'uuid';
import {
    CardUpdatedMessage,
    Command,
    ExtensionToVideoCommand,
    ImageModel,
    Message,
    PostMineAction,
    ScreenshotTakenMessage,
    ShowAnkiUiMessage,
    sourceString,
    StartRecordingMediaMessage,
    SubtitleModel,
    updateLastCard,
    VideoToExtensionCommand,
} from '@project/common';
import BackgroundPageManager from '../../services/background-page-manager';
import { CardPublisher } from '../../services/card-publisher';

export default class StartRecordingMediaHandler {
    private readonly _audioRecorder: BackgroundPageManager;
    private readonly _imageCapturer: ImageCapturer;
    private readonly _cardPublisher: CardPublisher;

    constructor(
        audioRecorder: BackgroundPageManager,
        imageCapturer: ImageCapturer,
        cardPublisher: CardPublisher
    ) {
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
            this._audioRecorder.start({ src: startRecordingCommand.src, tabId: sender.tab?.id });
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

            const id = uuidv4();

            let imageModel: ImageModel | undefined = undefined;

            if (imageBase64) {
                imageModel = {
                    base64: imageBase64,
                    extension: 'jpeg',
                };
            }

            this._cardPublisher.publish({
                id: id,
                subtitle: subtitle,
                surroundingSubtitles: [],
                image: imageModel,
                url: startRecordingCommand.message.url,
                subtitleFileName: startRecordingCommand.message.subtitleFileName,
                mediaTimestamp: startRecordingCommand.message.mediaTimestamp,
            });

            if (startRecordingCommand.message.postMineAction === PostMineAction.showAnkiDialog) {
                const showAnkiUiCommand: ExtensionToVideoCommand<ShowAnkiUiMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'show-anki-ui',
                        id: id,
                        subtitle: subtitle,
                        surroundingSubtitles: [],
                        image: imageModel,
                        url: startRecordingCommand.message.url,
                        subtitleFileName: startRecordingCommand.message.subtitleFileName,
                        mediaTimestamp: startRecordingCommand.message.mediaTimestamp,
                    },
                    src: startRecordingCommand.src,
                };

                chrome.tabs.sendMessage(sender.tab!.id!, showAnkiUiCommand);
            } else if (startRecordingCommand.message.postMineAction === PostMineAction.updateLastCard) {
                if (!startRecordingCommand.message.ankiSettings) {
                    throw new Error('Unable to update last card because anki settings is undefined');
                }

                const cardName = await updateLastCard(
                    startRecordingCommand.message.ankiSettings,
                    subtitle,
                    [],
                    undefined,
                    imageModel,
                    sourceString(
                        startRecordingCommand.message.subtitleFileName,
                        startRecordingCommand.message.mediaTimestamp
                    ),
                    startRecordingCommand.message.url
                );

                const cardUpdatedCommand: ExtensionToVideoCommand<CardUpdatedMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'card-updated',
                        cardName: `${cardName}`,
                        subtitle,
                        surroundingSubtitles: [],
                        image: imageModel,
                        url: startRecordingCommand.message.url,
                    },
                    src: startRecordingCommand.src,
                };

                chrome.tabs.sendMessage(sender.tab!.id!, cardUpdatedCommand);
            }
        }
    }
}
