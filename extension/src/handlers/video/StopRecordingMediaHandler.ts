import BackgroundPageAudioRecorder from '../../services/BackgroundPageAudioRecorder';
import ImageCapturer from '../../services/ImageCapturer';
import { v4 as uuidv4 } from 'uuid';
import {
    AudioModel,
    CardUpdatedMessage,
    Command,
    CopyMessage,
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    ImageModel,
    Message,
    mockSurroundingSubtitles,
    PostMineAction,
    RecordingFinishedMessage,
    ShowAnkiUiMessage,
    StopRecordingMediaMessage,
    SubtitleModel,
    VideoToExtensionCommand,
} from '@project/common';
import updateLastCard from '../../functions/updateLastCard';
import TabRegistry from '../../services/TabRegistry';

export default class StopRecordingMediaHandler {
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
        return 'stop-recording-media';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const stopRecordingCommand = command as VideoToExtensionCommand<StopRecordingMediaMessage>;

        try {
            const itemId = uuidv4();
            const subtitle: SubtitleModel = stopRecordingCommand.message.subtitle ?? {
                text: '',
                start: stopRecordingCommand.message.startTimestamp,
                end: stopRecordingCommand.message.endTimestamp,
                originalStart: stopRecordingCommand.message.startTimestamp,
                originalEnd: stopRecordingCommand.message.startTimestamp,
                track: 0,
            };
            const surroundingSubtitles =
                stopRecordingCommand.message.surroundingSubtitles ??
                mockSurroundingSubtitles(subtitle, stopRecordingCommand.message.videoDuration, 5000);

            let imageModel: ImageModel | undefined = undefined;

            if (stopRecordingCommand.message.screenshot) {
                let lastImageBase64 = this.imageCapturer.lastImageBase64;

                if (lastImageBase64 === undefined) {
                    lastImageBase64 = await this.imageCapturer.capture(sender.tab!.id!, stopRecordingCommand.src, 0);
                }

                imageModel = {
                    base64: lastImageBase64,
                    extension: 'jpeg',
                };
            }

            const mp3 = stopRecordingCommand.message.ankiSettings?.preferMp3 ?? false;
            const audioBase64 = await this.audioRecorder.stop(mp3);
            const audioModel: AudioModel = {
                base64: audioBase64,
                extension: mp3 ? 'mp3' : 'webm',
                paddingStart: 0,
                paddingEnd: 0,
                start: stopRecordingCommand.message.startTimestamp,
                end: stopRecordingCommand.message.endTimestamp,
                playbackRate: stopRecordingCommand.message.playbackRate,
            };

            const copyCommand: ExtensionToAsbPlayerCommand<CopyMessage> = {
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'copy',
                    id: itemId,
                    subtitle: subtitle,
                    surroundingSubtitles: surroundingSubtitles,
                    image: imageModel,
                    audio: audioModel,
                    url: stopRecordingCommand.message.url,
                },
                tabId: sender.tab!.id!,
                src: stopRecordingCommand.src,
            };
            this.tabRegistry.publishCommandToAsbplayers(() => copyCommand);

            if (stopRecordingCommand.message.postMineAction === PostMineAction.showAnkiDialog) {
                const showAnkiUiCommand: ExtensionToVideoCommand<ShowAnkiUiMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'show-anki-ui',
                        id: itemId,
                        subtitle: subtitle,
                        surroundingSubtitles: surroundingSubtitles,
                        image: imageModel,
                        audio: audioModel,
                        url: stopRecordingCommand.message.url,
                    },
                    src: stopRecordingCommand.src,
                };

                chrome.tabs.sendMessage(sender.tab!.id!, showAnkiUiCommand);
            } else if (stopRecordingCommand.message.postMineAction === PostMineAction.updateLastCard) {
                if (!stopRecordingCommand.message.ankiSettings) {
                    throw new Error('Unable to update last card because anki settings is undefined');
                }

                const cardName = await updateLastCard(
                    stopRecordingCommand.message.ankiSettings,
                    subtitle,
                    audioModel,
                    imageModel,
                    stopRecordingCommand.message.sourceString,
                    stopRecordingCommand.message.url
                );

                const cardUpdatedCommand: ExtensionToVideoCommand<CardUpdatedMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'card-updated',
                        cardName: `${cardName}`,
                        subtitle,
                        surroundingSubtitles: surroundingSubtitles,
                        image: imageModel,
                        audio: audioModel,
                        url: stopRecordingCommand.message.url,
                    },
                    src: stopRecordingCommand.src,
                };

                chrome.tabs.sendMessage(sender.tab!.id!, cardUpdatedCommand);
            }
        } finally {
            const recordingFinishedCommand: ExtensionToVideoCommand<RecordingFinishedMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'recording-finished',
                },
                src: stopRecordingCommand.src,
            };
            chrome.tabs.sendMessage(sender.tab!.id!, recordingFinishedCommand);
        }
    }
}
