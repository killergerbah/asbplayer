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
    CardUpdatedMessage,
    RecordingFinishedMessage,
} from '@project/common';
import updateLastCard from '../../functions/updateLastCard';
import TabRegistry from '../../services/TabRegistry';
import BackgroundPageAudioRecorder from '../../services/BackgroundPageAudioRecorder';

export default class RecordMediaHandler {
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
        return 'record-media-and-forward-subtitle';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const senderTab = sender.tab!;
        const recordMediaCommand = command as VideoToExtensionCommand<RecordMediaAndForwardSubtitleMessage>;

        try {
            const itemId = uuidv4();
            const subtitle = recordMediaCommand.message.subtitle;
            let audioPromise = undefined;
            let imagePromise = undefined;
            let imageModel: ImageModel | undefined = undefined;
            let audioModel: AudioModel | undefined = undefined;
            const mp3 = recordMediaCommand.message.ankiSettings?.preferMp3 ?? false;

            if (recordMediaCommand.message.record) {
                const time =
                    (subtitle.end - subtitle.start) / recordMediaCommand.message.playbackRate +
                    recordMediaCommand.message.audioPaddingEnd;
                audioPromise = this.audioRecorder.startWithTimeout(time, mp3);
            }

            if (recordMediaCommand.message.screenshot) {
                imagePromise = this.imageCapturer.capture(
                    senderTab.id!,
                    recordMediaCommand.src,
                    recordMediaCommand.message.imageDelay
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
                    extension: mp3 ? 'mp3' : 'webm',
                    paddingStart: recordMediaCommand.message.audioPaddingStart,
                    paddingEnd: recordMediaCommand.message.audioPaddingEnd,
                    playbackRate: recordMediaCommand.message.playbackRate,
                };
            }

            if (imagePromise) {
                // Use the last screenshot taken to allow user to re-take screenshot while audio is recording
                imageModel = {
                    base64: this.imageCapturer.consumeImage()!,
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

            const copyCommand: ExtensionToAsbPlayerCommand<CopyMessage> = {
                sender: 'asbplayer-extension-to-player',
                message: message,
                tabId: senderTab.id!,
                src: recordMediaCommand.src,
            };
            this.tabRegistry.publishCommandToAsbplayers(() => copyCommand);

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

                const cardName = await updateLastCard(
                    recordMediaCommand.message.ankiSettings,
                    subtitle,
                    audioModel,
                    imageModel,
                    recordMediaCommand.message.sourceString,
                    recordMediaCommand.message.url
                );

                const cardUpdatedCommand: ExtensionToVideoCommand<CardUpdatedMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'card-updated',
                        cardName: `${cardName}`,
                        subtitle,
                        surroundingSubtitles: recordMediaCommand.message.surroundingSubtitles,
                        audio: audioModel,
                        image: imageModel,
                        url: recordMediaCommand.message.url,
                    },
                    src: recordMediaCommand.src,
                };

                chrome.tabs.sendMessage(senderTab.id!, cardUpdatedCommand);
            }
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
