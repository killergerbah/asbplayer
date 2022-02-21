import {
    AnkiDialogRequestFromVideoMessage,
    AnkiSettings,
    AnkiSettingsToVideoMessage,
    AudioModel,
    AudioTrackModel,
    AudioTrackSelectedFromVideoMessage,
    AudioTrackSelectedToVideoMessage,
    CondensedModeToggleToVideoMessage,
    CopyMessage,
    CurrentTimeFromVideoMessage,
    FinishedAnkiDialogRequestToVideoMessage,
    HideSubtitlePlayerToggleToVideoMessage,
    ImageModel,
    MiscSettings,
    MiscSettingsToVideoMessage,
    OffsetFromVideoMessage,
    PauseFromVideoMessage,
    PlayFromVideoMessage,
    ReadyFromVideoMessage,
    ReadyStateFromVideoMessage,
    ReadyToVideoMessage,
    SubtitleModel,
    SubtitleSettings,
    SubtitleSettingsToVideoMessage,
    SubtitlesToVideoMessage,
    ToggleSubtitleTrackInListFromVideoMessage,
} from '@project/common';
import { VideoProtocol } from './VideoProtocol';

export default class VideoChannel {
    private readonly protocol: VideoProtocol;
    private time: number;
    private duration: number;
    private isReady: boolean;
    private readyState: number;
    private audioTracks?: AudioTrackModel[];
    private selectedAudioTrack?: string;
    private readyCallbacks: ((paused: boolean) => void)[];
    private playCallbacks: ((echo: boolean) => void)[];
    private pauseCallbacks: ((echo: boolean) => void)[];
    private audioTrackSelectedCallbacks: ((audioTrack: string) => void)[];
    private currentTimeCallbacks: ((currentTime: number, echo: boolean) => void)[];
    private exitCallbacks: (() => void)[];
    private offsetCallbacks: ((offset: number) => void)[];
    private popOutToggleCallbacks: (() => void)[];
    private copyCallbacks: ((
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        audio: AudioModel | undefined,
        image: ImageModel | undefined,
        url: string | undefined,
        preventDuplicate: boolean,
        id: string
    ) => void)[];
    private condensedModeToggleCallbacks: (() => void)[];
    private hideSubtitlePlayerToggleCallbacks: (() => void)[];
    private ankiDialogRequestCallbacks: ((forwardToVideo: boolean) => void)[];
    private toggleSubtitleTrackInListCallbacks: ((track: number) => void)[];

    oncanplay?: () => void;

    constructor(protocol: VideoProtocol) {
        this.protocol = protocol;
        this.time = 0;
        this.duration = 0;
        this.isReady = false;
        this.readyState = 0;
        this.selectedAudioTrack = undefined;
        this.readyCallbacks = [];
        this.playCallbacks = [];
        this.pauseCallbacks = [];
        this.currentTimeCallbacks = [];
        this.audioTrackSelectedCallbacks = [];
        this.exitCallbacks = [];
        this.offsetCallbacks = [];
        this.popOutToggleCallbacks = [];
        this.copyCallbacks = [];
        this.condensedModeToggleCallbacks = [];
        this.hideSubtitlePlayerToggleCallbacks = [];
        this.ankiDialogRequestCallbacks = [];
        this.toggleSubtitleTrackInListCallbacks = [];

        const that = this;

        this.protocol.onMessage = (event) => {
            switch (event.data.command) {
                case 'ready':
                    const readyMessage = event.data as ReadyFromVideoMessage;

                    that.duration = readyMessage.duration;
                    that.isReady = true;
                    that.audioTracks = readyMessage.audioTracks;
                    that.selectedAudioTrack = readyMessage.selectedAudioTrack;
                    that.readyState = 4;
                    that.time = readyMessage.currentTime;

                    for (let callback of that.readyCallbacks) {
                        callback(readyMessage.paused);
                    }
                    break;
                case 'readyState':
                    const readyStateMessage = event.data as ReadyStateFromVideoMessage;

                    that.readyState = readyStateMessage.value;
                    if (that.readyState === 4) {
                        that.oncanplay?.();
                    }
                    break;
                case 'play':
                    const playMessage = event.data as PlayFromVideoMessage;

                    for (let callback of that.playCallbacks) {
                        callback(playMessage.echo);
                    }
                    break;
                case 'pause':
                    const pauseMessage = event.data as PauseFromVideoMessage;

                    for (let callback of that.pauseCallbacks) {
                        callback(pauseMessage.echo);
                    }
                    break;
                case 'audioTrackSelected':
                    const audioTrackSelectedMessage = event.data as AudioTrackSelectedFromVideoMessage;

                    for (let callback of that.audioTrackSelectedCallbacks) {
                        that.selectedAudioTrack = audioTrackSelectedMessage.id;
                        callback(audioTrackSelectedMessage.id);
                    }
                    break;
                case 'currentTime':
                    const currentTimeMessage = event.data as CurrentTimeFromVideoMessage;

                    for (let callback of that.currentTimeCallbacks) {
                        callback(currentTimeMessage.value, currentTimeMessage.echo);
                    }
                    break;
                case 'exit':
                    for (let callback of that.exitCallbacks) {
                        callback();
                    }
                    break;
                case 'offset':
                    const offsetMessage = event.data as OffsetFromVideoMessage;

                    for (let callback of that.offsetCallbacks) {
                        callback(offsetMessage.value);
                    }
                    break;
                case 'popOutToggle':
                    for (let callback of that.popOutToggleCallbacks) {
                        callback();
                    }
                    break;
                case 'copy':
                    for (let callback of that.copyCallbacks) {
                        const copyMessage = event.data as CopyMessage;

                        callback(
                            copyMessage.subtitle,
                            copyMessage.surroundingSubtitles,
                            copyMessage.audio,
                            copyMessage.image,
                            copyMessage.url,
                            copyMessage.preventDuplicate ?? false,
                            copyMessage.id
                        );
                    }
                    break;
                case 'condensedModeToggle':
                    for (let callback of that.condensedModeToggleCallbacks) {
                        callback();
                    }
                    break;
                case 'hideSubtitlePlayerToggle':
                    for (let callback of that.hideSubtitlePlayerToggleCallbacks) {
                        callback();
                    }
                    break;
                case 'sync':
                    // ignore
                    break;
                case 'syncv2':
                    // ignore
                    break;
                case 'ankiDialogRequest':
                    const ankiDialogRequestMessage = event.data as AnkiDialogRequestFromVideoMessage;

                    for (let callback of that.ankiDialogRequestCallbacks) {
                        callback(ankiDialogRequestMessage.forwardToVideo);
                    }
                    break;
                case 'toggleSubtitleTrackInList':
                    const toggleSubtitleTrackInListMessage = event.data as ToggleSubtitleTrackInListFromVideoMessage;

                    for (const callback of that.toggleSubtitleTrackInListCallbacks) {
                        callback(toggleSubtitleTrackInListMessage.track);
                    }
                    break;
                case 'playbackRate':
                    // ignore for now
                    break;
                default:
                    console.error('Unrecognized event ' + event.data.command);
            }
        };
    }

    get currentTime() {
        return this.time;
    }

    set currentTime(value: number) {
        this.time = value;
        this.readyState = 3;
        this.protocol.postMessage({ command: 'currentTime', value: this.time } as CurrentTimeFromVideoMessage);
    }

    onReady(callback: (paused: boolean) => void) {
        if (this.isReady) {
            callback(false);
        }
        this.readyCallbacks.push(callback);
    }

    onPlay(callback: (echo: boolean) => void) {
        this.playCallbacks.push(callback);
    }

    onPause(callback: (echo: boolean) => void) {
        this.pauseCallbacks.push(callback);
    }

    onCurrentTime(callback: (currentTime: number, echo: boolean) => void) {
        this.currentTimeCallbacks.push(callback);
    }

    onAudioTrackSelected(callback: (id: string) => void) {
        this.audioTrackSelectedCallbacks.push(callback);
    }

    onExit(callback: () => void) {
        this.exitCallbacks.push(callback);
    }

    onOffset(callback: (offset: number) => void) {
        this.offsetCallbacks.push(callback);
    }

    onPopOutToggle(callback: () => void) {
        this.popOutToggleCallbacks.push(callback);
    }

    onCopy(callback: (
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        audio: AudioModel | undefined,
        image: ImageModel | undefined,
        url: string | undefined,
        preventDuplicate: boolean,
        id: string
    ) => void) {
        this.copyCallbacks.push(callback);
    }

    onCondensedModeToggle(callback: () => void) {
        this.condensedModeToggleCallbacks.push(callback);
    }

    onHideSubtitlePlayerToggle(callback: () => void) {
        this.hideSubtitlePlayerToggleCallbacks.push(callback);
    }

    onAnkiDialogRequest(callback: (forwardToVideo: boolean) => void) {
        this.ankiDialogRequestCallbacks.push(callback);
    }

    onToggleSubtitleTrackInList(callback: (track: number) => void) {
        this.toggleSubtitleTrackInListCallbacks.push(callback);
    }

    ready(duration: number) {
        this.protocol.postMessage({ command: 'ready', duration: duration } as ReadyToVideoMessage);
    }

    init() {
        this.protocol.postMessage({ command: 'init' });
    }

    play() {
        this.protocol.postMessage({ command: 'play' });
    }

    pause() {
        this.protocol.postMessage({ command: 'pause' });
    }

    audioTrackSelected(id: string) {
        this.protocol.postMessage({ command: 'audioTrackSelected', id: id } as AudioTrackSelectedToVideoMessage);
    }

    subtitles(subtitles: SubtitleModel[], subtitleFileNames: string[]) {
        this.protocol.postMessage({
            command: 'subtitles',
            value: subtitles,
            name: subtitleFileNames.length > 0 ? subtitleFileNames[0] : null,
            names: subtitleFileNames,
        } as SubtitlesToVideoMessage);
    }

    subtitleSettings(settings: SubtitleSettings) {
        this.protocol.postMessage({ command: 'subtitleSettings', value: settings } as SubtitleSettingsToVideoMessage);
    }

    condensedModeToggle(enabled: boolean) {
        this.protocol.postMessage({ command: 'condensedModeToggle', value: enabled } as CondensedModeToggleToVideoMessage);
    }

    hideSubtitlePlayerToggle(hidden: boolean) {
        this.protocol.postMessage({ command: 'hideSubtitlePlayerToggle', value: hidden } as HideSubtitlePlayerToggleToVideoMessage);
    }

    ankiDialogRequest() {
        this.protocol.postMessage({ command: 'ankiDialogRequest' });
    }

    finishedAnkiDialogRequest(resume: boolean) {
        this.protocol.postMessage({ command: 'finishedAnkiDialogRequest', resume: resume } as FinishedAnkiDialogRequestToVideoMessage);
    }

    ankiSettings(settings: AnkiSettings) {
        this.protocol.postMessage({ command: 'ankiSettings', value: settings } as AnkiSettingsToVideoMessage);
    }

    miscSettings(settings: MiscSettings) {
        this.protocol.postMessage({ command: 'miscSettings', value: settings } as MiscSettingsToVideoMessage);
    }

    close() {
        this.protocol.postMessage({ command: 'close' });
        this.protocol.close();
        this.readyCallbacks = [];
        this.playCallbacks = [];
        this.pauseCallbacks = [];
        this.currentTimeCallbacks = [];
        this.audioTrackSelectedCallbacks = [];
        this.exitCallbacks = [];
        this.offsetCallbacks = [];
        this.popOutToggleCallbacks = [];
        this.copyCallbacks = [];
        this.condensedModeToggleCallbacks = [];
        this.hideSubtitlePlayerToggleCallbacks = [];
        this.ankiDialogRequestCallbacks = [];
        this.toggleSubtitleTrackInListCallbacks = [];
    }
}
