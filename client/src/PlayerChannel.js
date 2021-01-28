export default function PlayerChannel(channel) {
    this.channel = new BroadcastChannel(channel);
    this.time = 0;
    this.duration = 0;
    this.playCallbacks = [];
    this.onPlay = function(callback) {
        this.playCallbacks.push(callback);
    };
    this.pauseCallbacks = [];
    this.onPause = function(callback) {
        this.pauseCallbacks.push(callback);
    };
    this.currentTimeCallbacks = [];
    this.onCurrentTime = function(callback) {
        this.currentTimeCallbacks.push(callback);
    };
    this.audioTrackSelectedCallbacks = [];
    this.onAudioTrackSelected = function(callback) {
        this.audioTrackSelectedCallbacks.push(callback);
    };
    this.closeCallbacks = [];
    this.onClose = function(callback) {
        this.closeCallbacks.push(callback);
    };
    this.readyCallbacks = [];
    this.onReady = function(callback) {
        this.readyCallbacks.push(callback);
    }

    const that = this;

    this.channel.onmessage = function(event) {
        switch(event.data.command) {
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
            default:
                console.error('Unrecognized event ' + event.data.command);
        }
    };

    this.ready = function(duration, audioTracks, selectedAudioTrack) {
        this.channel.postMessage({
            command: 'ready',
            duration: duration,
            audioTracks: audioTracks,
            selectedAudioTrack: selectedAudioTrack
        });
    }

    this.play = function() {
        this.channel.postMessage({command: 'play'});
    };

    this.pause = function() {
        this.channel.postMessage({command: 'pause'});
    };

    this.audioTrackSelected = function(id) {
        this.channel.postMessage({command: 'audioTrackSelected', id: id});
    };

    this.close = function() {
        this.channel.close();
        this.channel = null;
    }

    Object.defineProperty(this, "currentTime", {
        get: function() {
            return this.time;
        },
        set: function(value) {
            this.time = value;
            this.channel.postMessage({command: 'currentTime', value: this.time});
        }
    });
}