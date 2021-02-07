export default class VideoChannel {

    constructor(protocol) {
        this.protocol = protocol;
        this.time = 0;
        this.duration = 0;
        this.isReady = false;
        this.readyState = 0;
        this.readyCallbacks = [];
        this.playCallbacks = [];
        this.pauseCallbacks = [];
        this.currentTimeCallbacks = [];
        this.audioTrackSelectedCallbacks = [];

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
                        callback(event.data.id);
                    }
                    break;
                case 'currentTime':
                    for (let callback of that.currentTimeCallbacks) {
                        callback(event.data.value, event.data.echo);
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

    close() {
        this.protocol.postMessage({command: 'close'});
        this.protocol.close();
    }
}