export default class VideoChannel {

    constructor(channel) {
        this.channel = new BroadcastChannel(channel);
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

        this.channel.onmessage = (event) => {
            switch(event.data.command) {
                case 'ready':
                    that.duration = event.data.duration;
                    that.isReady = true;
                    that.audioTracks = event.data.audioTracks;
                    that.selectedAudioTrack = event.data.selectedAudioTrack;
                    that.readyState = 4;

                    for (let callback of that.readyCallbacks) {
                        callback();
                    }
                    break;
                case 'readyState':
                    console.log("readyState received " + event.data.value);
                    that.readyState = event.data.value;
                    if (that.readyState === 4) {
                        that.oncanplay?.();
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
                case 'audioTrackSelected':
                    for (let callback of that.audioTrackSelectedCallbacks) {
                        callback(event.data.id);
                    }
                    break;
                case 'currentTime':
                    for (let callback of that.currentTimeCallbacks) {
                        callback(event.data.value);
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
        this.channel.postMessage({command: 'currentTime', value: this.time});
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
        this.channel.postMessage({command: 'ready', duration: duration});
    }

    play() {
        this.channel.postMessage({command: 'play'});
    }

    pause() {
        this.channel.postMessage({command: 'pause'});
    }

    audioTrackSelected(id) {
        this.channel.postMessage({command: 'audioTrackSelected', id: id});
    }

    close() {
        this.channel.postMessage({command: 'close'});
        this.channel.close();
    }
}