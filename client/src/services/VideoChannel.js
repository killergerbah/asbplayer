export default class VideoChannel {

    constructor(protocol) {
        this.protocol = protocol;
        this.time = 0;
        this.duration = 0;
        this.isReady = false;
        this.readyState = 0;
        this.selectedAudioTrack = null;
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
            switch(event.data.command) {
                case 'ready':
                    that.duration = event.data.duration;
                    that.isReady = true;
                    that.audioTracks = event.data.audioTracks;
                    that.selectedAudioTrack = event.data.selectedAudioTrack;
                    that.readyState = 4;
                    that.time = event.data.currentTime;

                    for (let callback of that.readyCallbacks) {
                        callback(event.data.paused);
                    }
                    break;
                case 'readyState':
                    that.readyState = event.data.value;
                    if (that.readyState === 4) {
                        that.oncanplay?.();
                    }
                    break;
                case 'play':
                    for (let callback of that.playCallbacks) {
                        callback(event.data.echo);
                    }
                    break;
                case 'pause':
                    for (let callback of that.pauseCallbacks) {
                        callback(event.data.echo);
                    }
                    break;
                case 'audioTrackSelected':
                    for (let callback of that.audioTrackSelectedCallbacks) {
                        that.selectedAudioTrack = event.data.id;
                        callback(event.data.id);
                    }
                    break;
                case 'currentTime':
                    for (let callback of that.currentTimeCallbacks) {
                        callback(event.data.value, event.data.echo);
                    }
                    break;
                case 'exit':
                    for (let callback of that.exitCallbacks) {
                        callback();
                    }
                    break;
                case 'offset':
                    for (let callback of that.offsetCallbacks) {
                        callback(event.data.value);
                    }
                    break;
                case 'popOutToggle':
                    for (let callback of that.popOutToggleCallbacks) {
                        callback();
                    }
                    break;
                case 'copy':
                    for (let callback of that.copyCallbacks) {
                        callback(event.data.subtitle, event.data.audio, event.data.image, event.data.preventDuplicate);
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
                    for (let callback of that.ankiDialogRequestCallbacks) {
                        callback(event.data.forwardToVideo);
                    }
                    break;
                case 'toggleSubtitleTrackInList':
                    for (const callback of that.toggleSubtitleTrackInListCallbacks) {
                        callback(event.data.track);
                    }
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
        this.readyState = 3;
        this.protocol.postMessage({command: 'currentTime', value: this.time});
    }

    onReady(callback) {
        if (this.isReady) {
            callback();
        }
        this.readyCallbacks.push(callback);
    }

    onPlay(callback) {
        this.playCallbacks.push(callback);
    }

    onPause(callback) {
        this.pauseCallbacks.push(callback);
    }

    onCurrentTime(callback) {
        this.currentTimeCallbacks.push(callback);
    }

    onAudioTrackSelected(callback) {
        this.audioTrackSelectedCallbacks.push(callback);
    }

    onExit(callback) {
        this.exitCallbacks.push(callback);
    }

    onOffset(callback) {
        this.offsetCallbacks.push(callback);
    }

    onPopOutToggle(callback) {
        this.popOutToggleCallbacks.push(callback);
    }

    onCopy(callback) {
        this.copyCallbacks.push(callback);
    }

    onCondensedModeToggle(callback) {
        this.condensedModeToggleCallbacks.push(callback);
    }

    onHideSubtitlePlayerToggle(callback) {
        this.hideSubtitlePlayerToggleCallbacks.push(callback);
    }

    onAnkiDialogRequest(callback) {
        this.ankiDialogRequestCallbacks.push(callback);
    }

    onToggleSubtitleTrackInList(callback) {
        this.toggleSubtitleTrackInListCallbacks.push(callback);
    }

    ready(duration) {
        this.protocol.postMessage({command: 'ready', duration: duration});
    }

    init() {
        this.protocol.postMessage({command: 'init'});
    }

    play() {
        this.protocol.postMessage({command: 'play'});
    }

    pause() {
        this.protocol.postMessage({command: 'pause'});
    }

    audioTrackSelected(id) {
        this.protocol.postMessage({command: 'audioTrackSelected', id: id});
    }

    subtitles(subtitles, subtitleFileNames) {
        this.protocol.postMessage({
            command: 'subtitles',
            value: subtitles,
            name: subtitleFileNames.length > 0 ? subtitleFileNames[0] : null,
            names: subtitleFileNames
        });
    }

    subtitleSettings(settings) {
        this.protocol.postMessage({command: 'subtitleSettings', value: settings});
    }

    condensedModeToggle(enabled) {
        this.protocol.postMessage({command: 'condensedModeToggle', value: enabled});
    }

    hideSubtitlePlayerToggle(hidden) {
        this.protocol.postMessage({command: 'hideSubtitlePlayerToggle', value: hidden});
    }

    ankiDialogRequest() {
        this.protocol.postMessage({command: 'ankiDialogRequest'});
    }

    finishedAnkiDialogRequest() {
        this.protocol.postMessage({command: 'finishedAnkiDialogRequest'});
    }

    ankiSettings(settings) {
        this.protocol.postMessage({command: 'ankiSettings', value: settings});
    }

    miscSettings(settings) {
        this.protocol.postMessage({command: 'miscSettings', value: settings});
    }

    close() {
        this.protocol.postMessage({command: 'close'});
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