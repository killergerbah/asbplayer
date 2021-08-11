import AudioRecorder from '../../services/AudioRecorder';
import { v4 as uuidv4 } from 'uuid';

export default class RerecordMediaHandler {

    constructor(audioRecorder) {
        this.audioRecorder = audioRecorder;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'rerecord-media';
    }

    async handle(request, sender) {
        const windowActive = await this._isWindowActive(sender.tab.windowId);

        if (!windowActive) {
            console.error("Received rerecord request from wrong window.");
            return;
        }

        const audio = {
            base64: await this.audioRecorder.record(request.message.duration + request.message.audioPaddingEnd),
            extension: 'webm',
            paddingStart: request.message.audioPaddingStart,
            paddingEnd: request.message.audioPaddingEnd
        };

        chrome.tabs.query({}, (allTabs) => {
            for (let t of allTabs) {
                chrome.tabs.sendMessage(t.id, {
                    sender: 'asbplayer-extension-to-player',
                    message: {
                        command: 'copy',
                        // Ideally we send the same ID so that asbplayer can update the existing item.
                        // There's a bug where asbplayer isn't properly updating the item right now, so
                        // let's just create a new item for now by using a new ID.
                        id: uuidv4(),
                        audio: audio,
                        image: request.message.currentItem.image,
                        subtitle: request.message.currentItem.subtitle,
                        surroundingSubtitles: request.message.currentItem.surroundingSubtitles
                    },
                    tabId: sender.tab.id,
                    src: request.src
                });
            }
        });

        const newUiState = {
            ...request.message.uiState,
            audio: audio
        };

        chrome.tabs.sendMessage(sender.tab.id, {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'show-anki-ui-after-rerecord',
                id: request.message.currentItem.id,
                uiState: newUiState
            },
            src: request.src
        });
    }

    async _isWindowActive(windowId) {
        return new Promise((resolve, reject) => {
            chrome.windows.getLastFocused(null, (window) => {
                resolve(window.id === windowId);
            });
        });
    }
}