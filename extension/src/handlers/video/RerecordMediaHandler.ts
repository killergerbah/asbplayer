import AudioRecorder from '../../services/AudioRecorder';
import { v4 as uuidv4 } from 'uuid';
import {
    AudioModel,
    Command,
    CopyMessage,
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    Message,
    RerecordMediaMessage,
    ShowAnkiUiAfterRerecordMessage,
    VideoToExtensionCommand,
} from '@project/common';

export default class RerecordMediaHandler {
    private readonly audioRecorder: AudioRecorder;

    constructor(audioRecorder: AudioRecorder) {
        this.audioRecorder = audioRecorder;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'rerecord-media';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const rerecordCommand = command as VideoToExtensionCommand<RerecordMediaMessage>;

        const windowActive = await this._isWindowActive(sender.tab!.windowId);

        if (!windowActive) {
            console.error('Received rerecord request from wrong window.');
            return;
        }

        const audio: AudioModel = {
            base64: await this.audioRecorder.startWithTimeout(
                rerecordCommand.message.duration / rerecordCommand.message.playbackRate +
                    rerecordCommand.message.audioPaddingEnd
            ),
            extension: 'webm',
            paddingStart: rerecordCommand.message.audioPaddingStart,
            paddingEnd: rerecordCommand.message.audioPaddingEnd,
            start: rerecordCommand.message.timestamp,
            end:
                rerecordCommand.message.timestamp +
                rerecordCommand.message.duration / rerecordCommand.message.playbackRate,
        };

        chrome.tabs.query({}, (allTabs) => {
            const copyCommand: ExtensionToAsbPlayerCommand<CopyMessage> = {
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'copy',
                    // Ideally we send the same ID so that asbplayer can update the existing item.
                    // There's a bug where asbplayer isn't properly updating the item right now, so
                    // let's just create a new item for now by using a new ID.
                    id: uuidv4(),
                    audio: audio,
                    image: rerecordCommand.message.currentItem.image,
                    url: rerecordCommand.message.currentItem.url,
                    subtitle: rerecordCommand.message.currentItem.subtitle,
                    surroundingSubtitles: rerecordCommand.message.currentItem.surroundingSubtitles,
                },
                tabId: sender.tab!.id!,
                src: rerecordCommand.src,
            };

            for (let t of allTabs) {
                chrome.tabs.sendMessage(t.id!, copyCommand);
            }
        });

        const newUiState = {
            ...rerecordCommand.message.uiState,
            audio: audio,
        };

        const showAnkiUiAfterRerecordCommand: ExtensionToVideoCommand<ShowAnkiUiAfterRerecordMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'show-anki-ui-after-rerecord',
                id: rerecordCommand.message.currentItem.id,
                uiState: newUiState,
                audio: audio,
            },
            src: rerecordCommand.src,
        };

        chrome.tabs.sendMessage(sender.tab!.id!, showAnkiUiAfterRerecordCommand);
    }

    async _isWindowActive(windowId: number) {
        return new Promise((resolve, reject) => {
            chrome.windows.getLastFocused((window) => {
                resolve(window.id === windowId);
            });
        });
    }
}
