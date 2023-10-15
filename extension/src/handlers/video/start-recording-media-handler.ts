import ImageCapturer from '../../services/image-capturer';
import { v4 as uuidv4 } from 'uuid';
import {
    CardUpdatedMessage,
    Command,
    CopyMessage,
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    ImageModel,
    Message,
    PostMineAction,
    ScreenshotTakenMessage,
    ShowAnkiUiMessage,
    StartRecordingMediaMessage,
    SubtitleModel,
    updateLastCard,
    VideoToExtensionCommand,
} from '@project/common';
import BackgroundPageAudioRecorder from '../../services/background-page-audio-recorder';
import TabRegistry from '../../services/tab-registry';

export default class StartRecordingMediaHandler {
    private readonly audioRecorder: BackgroundPageAudioRecorder;
    private readonly imageCapturer: ImageCapturer;
    private readonly tabRegistry: TabRegistry;

    constructor(audioRecorder: BackgroundPageAudioRecorder, imageCapturer: ImageCapturer, tabRegistry: TabRegistry) {
        this.audioRecorder = audioRecorder;
        this.imageCapturer = imageCapturer;
        this.tabRegistry = tabRegistry;
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
            this.audioRecorder.start({ src: startRecordingCommand.src, tabId: sender.tab?.id });
        }

        let imageBase64: string | undefined;

        if (startRecordingCommand.message.screenshot) {
            const imageDelay = startRecordingCommand.message.record ? startRecordingCommand.message.imageDelay : 0;
            const { maxWidth, maxHeight, rect, frameId } = startRecordingCommand.message;
            imageBase64 = await this.imageCapturer.capture(sender.tab!.id!, startRecordingCommand.src, imageDelay, {
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
                start: startRecordingCommand.message.timestamp,
                originalStart: startRecordingCommand.message.timestamp,
                end: startRecordingCommand.message.timestamp,
                originalEnd: startRecordingCommand.message.timestamp,
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

            const copyCommand: ExtensionToAsbPlayerCommand<CopyMessage> = {
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'copy',
                    id: id,
                    subtitle: subtitle,
                    surroundingSubtitles: [],
                    image: imageModel,
                    url: startRecordingCommand.message.url,
                },
                tabId: sender.tab!.id!,
                src: startRecordingCommand.src,
            };

            this.tabRegistry.publishCommandToAsbplayers({ commandFactory: () => copyCommand });

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
                    startRecordingCommand.message.sourceString,
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
