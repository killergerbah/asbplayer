export default function VideoChannel(channel) {
    this.channel = new BroadcastChannel(channel);
    this.time = 0;
    this.duration = 0;
    this.loaded = false;
    this.loadedCallbacks = [];
    this.onLoaded = function(callback) {
        this.loadedCallbacks.push(callback);
    };

    const that = this;

    this.channel.onmessage = function(event) {
        if (event.data.command === 'ready') {
            that.duration = event.data.duration;
            that.loaded = true;

            for (let callback of that.loadedCallbacks) {
                callback();
            }
        }
    };

    this.play = function() {
        this.channel.postMessage({command: 'play'});
    };

    this.pause = function() {
        this.channel.postMessage({command: 'pause'});
    };

    this.close = function() {
        this.channel.postMessage({command: 'close'});
        this.channel.close();
    };

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