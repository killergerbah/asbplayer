import {
    AnkiDialogRequestFromVideoMessage,
    AudioTrackModel,
    AudioTrackSelectedFromVideoMessage,
    AudioTrackSelectedToVideoMessage,
    CondensedModeToggleToVideoMessage,
    CopyMessage,
    CurrentTimeToVideoMessage,
    FinishedAnkiDialogRequestToVideoMessage,
    HideSubtitlePlayerToggleToVideoMessage,
    OffsetFromVideoMessage,
    PauseFromVideoMessage,
    PlayFromVideoMessage,
    ReadyFromVideoMessage,
    ReadyStateFromVideoMessage,
    ReadyToVideoMessage,
    SubtitleModel,
    SubtitlesToVideoMessage,
    ToggleSubtitleTrackInListFromVideoMessage,
} from '@project/common';

export default class PlayerChannel {
    private channel?: BroadcastChannel;
    private time: number;
    private duration: number;
    private readyCallbacks: ((duration: number) => void)[];
    private playCallbacks: (() => void)[];
    private pauseCallbacks: (() => void)[];
    private currentTimeCallbacks: ((currentTime: number) => void)[];
    private audioTrackSelectedCallbacks: ((id: string) => void)[];
    private closeCallbacks: (() => void)[];
    private subtitlesCallbacks: ((subtitles: SubtitleModel[]) => void)[];
    private condensedModeToggleCallbacks: ((enabled: boolean) => void)[];
    private hideSubtitlePlayerToggleCallbacks: ((enabled: boolean) => void)[];
    private ankiDialogRequestCallbacks: (() => void)[];
    private finishedAnkiDialogRequestCallbacks: ((resume: boolean) => void)[];

    constructor(channel: string) {
        this.channel = new BroadcastChannel(channel);
        this.time = 0;
        this.duration = 0;
        this.playCallbacks = [];
        this.pauseCallbacks = [];
        this.currentTimeCallbacks = [];
        this.audioTrackSelectedCallbacks = [];
        this.closeCallbacks = [];
        this.readyCallbacks = [];
        this.subtitlesCallbacks = [];
        this.condensedModeToggleCallbacks = [];
        this.hideSubtitlePlayerToggleCallbacks = [];
        this.ankiDialogRequestCallbacks = [];
        this.finishedAnkiDialogRequestCallbacks = [];

        const that = this;

        this.channel.onmessage = (event) => {
            switch (event.data.command) {
                case 'init':
                    // ignore, this is for the chrome extension
                    break;
                case 'ready':
                    const readyMessage = event.data as ReadyToVideoMessage;

                    for (let callback of that.readyCallbacks) {
                        callback(readyMessage.duration);
                    }
                    break;
                case 'play':
                    for (let callback of that.playCallbacks) {
                        callback();
                    }
                    break;
                case 'pause':
                    for (let callback of that.pauseCallbacks) {
                        callback();
                    }
                    break;
                case 'currentTime':
                    const currentTimeMessage = event.data as CurrentTimeToVideoMessage;

                    for (let callback of that.currentTimeCallbacks) {
                        callback(currentTimeMessage.value);
                    }
                    break;
                case 'audioTrackSelected':
                    const audioTrackSelectedMessage = event.data as AudioTrackSelectedToVideoMessage;

                    for (let callback of that.audioTrackSelectedCallbacks) {
                        callback(audioTrackSelectedMessage.id);
                    }
                    break;
                case 'close':
                    for (let callback of that.closeCallbacks) {
                        callback();
                    }
                    break;
                case 'subtitles':
                    const subtitlesMessage = event.data as SubtitlesToVideoMessage;

                    for (let callback of that.subtitlesCallbacks) {
                        callback(subtitlesMessage.value);
                    }
                    break;
                case 'subtitleSettings':
                    // ignore
                    break;
                case 'condensedModeToggle':
                    const condensedModeToggleMessage = event.data as CondensedModeToggleToVideoMessage;

                    for (let callback of that.condensedModeToggleCallbacks) {
                        callback(condensedModeToggleMessage.value);
                    }
                    break;
                case 'hideSubtitlePlayerToggle':
                    const hideSubtitlePlayerToggleMessage = event.data as HideSubtitlePlayerToggleToVideoMessage;

                    for (let callback of that.hideSubtitlePlayerToggleCallbacks) {
                        callback(hideSubtitlePlayerToggleMessage.value);
                    }
                    break;
                case 'ankiDialogRequest':
                    for (let callback of that.ankiDialogRequestCallbacks) {
                        callback();
                    }
                    break;
                case 'finishedAnkiDialogRequest':
                    const finishedAnkiDialogRequestMessage = event.data as FinishedAnkiDialogRequestToVideoMessage;

                    for (let callback of that.finishedAnkiDialogRequestCallbacks) {
                        callback(finishedAnkiDialogRequestMessage.resume);
                    }
                    break;
                case 'ankiSettings':
                    // ignore
                    break;
                case 'miscSettings':
                    // ignore
                    break;
                default:
                    console.error('Unrecognized event ' + event.data.command);
            }
        };
    }

    get currentTime() {
        return this.time;
    }

    set currentTime(value) {
        this.time = value;
        this.channel?.postMessage({ command: 'currentTime', value: this.time, echo: true });
    }

    onPlay(callback: () => void) {
        this.playCallbacks.push(callback);
    }

    onPause(callback: () => void) {
        this.pauseCallbacks.push(callback);
    }

    onCurrentTime(callback: (currentTime: number) => void) {
        this.currentTimeCallbacks.push(callback);
    }

    onAudioTrackSelected(callback: (id: string) => void) {
        this.audioTrackSelectedCallbacks.push(callback);
    }

    onClose(callback: () => void) {
        this.closeCallbacks.push(callback);
    }

    onReady(callback: (duration: number) => void) {
        this.readyCallbacks.push(callback);
    }

    onSubtitles(callback: (subtitles: SubtitleModel[]) => void) {
        this.subtitlesCallbacks.push(callback);
    }

    onCondensedModeToggle(callback: (enabled: boolean) => void) {
        this.condensedModeToggleCallbacks.push(callback);
    }

    onHideSubtitlePlayerToggle(callback: (enabled: boolean) => void) {
        this.hideSubtitlePlayerToggleCallbacks.push(callback);
    }

    onAnkiDialogRequest(callback: () => void) {
        this.ankiDialogRequestCallbacks.push(callback);
    }

    onFinishedAnkiDialogRequest(callback: (resume: boolean) => void) {
        this.finishedAnkiDialogRequestCallbacks.push(callback);
    }

    ready(
        duration: number,
        paused: boolean,
        audioTracks: AudioTrackModel[] | undefined,
        selectedAudioTrack: string | undefined
    ) {
        const message: ReadyFromVideoMessage = {
            command: 'ready',
            duration: duration,
            paused: paused,
            currentTime: 0,
            audioTracks: audioTracks,
            selectedAudioTrack: selectedAudioTrack,
            playbackRate: 1,
        };

        this.channel?.postMessage(message);
    }

    readyState(readyState: number) {
        const message: ReadyStateFromVideoMessage = { command: 'readyState', value: readyState };
        this.channel?.postMessage(message);
    }

    play() {
        const message: PlayFromVideoMessage = { command: 'play', echo: true };
        this.channel?.postMessage(message);
    }

    pause() {
        const message: PauseFromVideoMessage = { command: 'pause', echo: true };
        this.channel?.postMessage(message);
    }

    audioTrackSelected(id: string) {
        const message: AudioTrackSelectedFromVideoMessage = { command: 'audioTrackSelected', id: id };
        this.channel?.postMessage(message);
    }

    offset(offset: number) {
        const message: OffsetFromVideoMessage = { command: 'offset', value: offset };
        this.channel?.postMessage(message);
    }

    popOutToggle() {
        this.channel?.postMessage({ command: 'popOutToggle' });
    }

    copy(subtitle: SubtitleModel, surroundingSubtitles: SubtitleModel[], preventDuplicate?: boolean) {
        const message: CopyMessage = {
            command: 'copy',
            subtitle: subtitle,
            surroundingSubtitles: surroundingSubtitles,
            preventDuplicate: preventDuplicate,
        };

        this.channel?.postMessage(message);
    }

    condensedModeToggle() {
        this.channel?.postMessage({ command: 'condensedModeToggle' });
    }

    hideSubtitlePlayerToggle() {
        this.channel?.postMessage({ command: 'hideSubtitlePlayerToggle' });
    }

    ankiDialogRequest(forwardToVideo: boolean) {
        const message: AnkiDialogRequestFromVideoMessage = {
            command: 'ankiDialogRequest',
            forwardToVideo: forwardToVideo,
        };
        this.channel?.postMessage(message);
    }

    toggleSubtitleTrackInList(track: number) {
        const message: ToggleSubtitleTrackInListFromVideoMessage = {
            command: 'toggleSubtitleTrackInList',
            track: track,
        };
        this.channel?.postMessage(message);
    }

    close() {
        if (this.channel) {
            this.channel.postMessage({ command: 'exit' });
            this.channel.close();
            this.channel = undefined;
            this.playCallbacks = [];
            this.pauseCallbacks = [];
            this.currentTimeCallbacks = [];
            this.audioTrackSelectedCallbacks = [];
            this.closeCallbacks = [];
            this.readyCallbacks = [];
            this.subtitlesCallbacks = [];
            this.condensedModeToggleCallbacks = [];
            this.hideSubtitlePlayerToggleCallbacks = [];
            this.ankiDialogRequestCallbacks = [];
            this.finishedAnkiDialogRequestCallbacks = [];
        }
    }
}
