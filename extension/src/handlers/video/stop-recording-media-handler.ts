import OffscreenAudioRecorder from '../../services/offscreen-audio-recorder';
import ImageCapturer from '../../services/image-capturer';
import {
    AudioModel,
    Command,
    ExtensionToVideoCommand,
    ImageModel,
    Message,
    RecordingFinishedMessage,
    StopRecordingMediaMessage,
    SubtitleModel,
    VideoToExtensionCommand,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { mockSurroundingSubtitles } from '@project/common/util';
import { CardPublisher } from '../../services/card-publisher';

export default class StopRecordingMediaHandler {
    private readonly _audioRecorder: OffscreenAudioRecorder;
    private readonly _imageCapturer: ImageCapturer;
    private readonly _cardPublisher: CardPublisher;
    private readonly _settingsProvider: SettingsProvider;

    constructor(
        audioRecorder: OffscreenAudioRecorder,
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
        return 'stop-recording-media';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const stopRecordingCommand = command as VideoToExtensionCommand<StopRecordingMediaMessage>;

        try {
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
                let lastImageBase64 = this._imageCapturer.lastImageBase64;

                if (lastImageBase64 === undefined) {
                    const { maxWidth, maxHeight, rect, frameId } = stopRecordingCommand.message;
                    lastImageBase64 = await this._imageCapturer.capture(sender.tab!.id!, stopRecordingCommand.src, 0, {
                        maxWidth,
                        maxHeight,
                        rect,
                        frameId,
                    });
                }

                imageModel = {
                    base64: lastImageBase64,
                    extension: 'jpeg',
                };
            }

            const preferMp3 = await this._settingsProvider.getSingle('preferMp3');
            const audioBase64 = await this._audioRecorder.stop(preferMp3);
            const audioModel: AudioModel = {
                base64: audioBase64,
                extension: preferMp3 ? 'mp3' : 'webm',
                paddingStart: 0,
                paddingEnd: 0,
                start: stopRecordingCommand.message.startTimestamp,
                end: stopRecordingCommand.message.endTimestamp,
                playbackRate: stopRecordingCommand.message.playbackRate,
            };

            this._cardPublisher.publish(
                {
                    subtitle: subtitle,
                    surroundingSubtitles: surroundingSubtitles,
                    image: imageModel,
                    audio: audioModel,
                    url: stopRecordingCommand.message.url,
                    subtitleFileName: stopRecordingCommand.message.subtitleFileName,
                    mediaTimestamp: stopRecordingCommand.message.startTimestamp,
                },
                stopRecordingCommand.message.postMineAction,
                sender.tab!.id!,
                stopRecordingCommand.src
            );
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
