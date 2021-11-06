export default class PlayerChannel {
    constructor(channel) {
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
                    for (let callback of that.readyCallbacks) {
                        callback(event.data.duration);
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
                    for (let callback of that.currentTimeCallbacks) {
                        callback(event.data.value);
                    }
                    break;
                case 'audioTrackSelected':
                    for (let callback of that.audioTrackSelectedCallbacks) {
                        callback(event.data.id);
                    }
                    break;
                case 'close':
                    for (let callback of that.closeCallbacks) {
                        callback();
                    }
                    break;
                case 'subtitles':
                    for (let callback of that.subtitlesCallbacks) {
                        callback(event.data.value);
                    }
                    break;
                case 'subtitleSettings':
                    // ignore
                    break;
                case 'condensedModeToggle':
                    for (let callback of that.condensedModeToggleCallbacks) {
                        callback(event.data.value);
                    }
                    break;
                case 'hideSubtitlePlayerToggle':
                    for (let callback of that.hideSubtitlePlayerToggleCallbacks) {
                        callback(event.data.value);
                    }
                    break;
                case 'ankiDialogRequest':
                    for (let callback of that.ankiDialogRequestCallbacks) {
                        callback();
                    }
                    break;
                case 'finishedAnkiDialogRequest':
                    for (let callback of that.finishedAnkiDialogRequestCallbacks) {
                        callback(event.data.resume);
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

    onClose(callback) {
        this.closeCallbacks.push(callback);
    }

    onReady(callback) {
        this.readyCallbacks.push(callback);
    }

    onSubtitles(callback) {
        this.subtitlesCallbacks.push(callback);
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

    onFinishedAnkiDialogRequest(callback) {
        this.finishedAnkiDialogRequestCallbacks.push(callback);
    }

    ready(duration, paused, audioTracks, selectedAudioTrack) {
        this.channel?.postMessage({
            command: 'ready',
            duration: duration,
            paused: paused,
            currentTime: 0,
            audioTracks: audioTracks,
            selectedAudioTrack: selectedAudioTrack,
        });
    }

    readyState(readyState) {
        this.channel?.postMessage({ command: 'readyState', value: readyState });
    }

    play() {
        this.channel?.postMessage({ command: 'play', echo: true });
    }

    pause() {
        this.channel?.postMessage({ command: 'pause', echo: true });
    }

    audioTrackSelected(id) {
        this.channel?.postMessage({ command: 'audioTrackSelected', id: id });
    }

    offset(offset) {
        this.channel?.postMessage({ command: 'offset', value: offset });
    }

    popOutToggle() {
        this.channel?.postMessage({ command: 'popOutToggle' });
    }

    copy(subtitle, surroundingSubtitles, preventDuplicate) {
        this.channel?.postMessage({
            command: 'copy',
            subtitle: subtitle,
            surroundingSubtitles: surroundingSubtitles,
            preventDuplicate: preventDuplicate,
        });
    }

    condensedModeToggle() {
        this.channel?.postMessage({ command: 'condensedModeToggle' });
    }

    hideSubtitlePlayerToggle() {
        this.channel?.postMessage({ command: 'hideSubtitlePlayerToggle' });
    }

    ankiDialogRequest(forwardToVideo) {
        this.channel?.postMessage({ command: 'ankiDialogRequest', forwardToVideo: forwardToVideo });
    }

    toggleSubtitleTrackInList(track) {
        this.channel?.postMessage({ command: 'toggleSubtitleTrackInList', track: track });
    }

    close() {
        if (this.channel) {
            this.channel.postMessage({ command: 'exit' });
            this.channel.close();
            this.channel = null;
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
