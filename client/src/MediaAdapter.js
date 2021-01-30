export default class MediaAdapter {

    constructor(audioRef, videoRef) {
        this.audioRef = audioRef;
        this.videoRef = videoRef;
        this.audioReadyResolves = [];
        this.videoReadyResolves = [];
    }

    seek(time) {
        const audioReadyPromise = new Promise((resolve, reject) => {
            if (this.audioRef.current) {
                this.audioRef.current.currentTime = time;
                this._onAudioCanPlay(() => resolve());
            } else {
                resolve();
            }
        });

        const videoReadyPromise = new Promise((resolve, reject) => {
            if (this.videoRef.current) {
                this.videoRef.current.currentTime = time;
                this._onVideoCanPlay(() => resolve());
            } else {
                resolve();
            }
        });

        return Promise.all([audioReadyPromise, videoReadyPromise]);
    }

    _onAudioCanPlay(callback) {
        this._onMediaCanPlay(this.audioRef, this.audioReadyResolves, callback);
    }

    _onVideoCanPlay(callback) {
        this._onMediaCanPlay(this.videoRef, this.videoReadyResolves, callback);
    }

    _onMediaCanPlay(mediaRef, resolves, callback) {
        if (mediaRef.readyState === 4) {
            callback();
            return;
        }

        if (mediaRef.current && !mediaRef.current.oncanplay) {
            mediaRef.current.oncanplay = (e) => {
                for (let resolve of resolves) {
                    resolve();
                }

                resolves.length = 0;
                mediaRef.current.oncanplay = null;
            }
        }

        resolves.push(callback);
    }

    play() {
        if (this.audioRef.current) {
            this.audioRef.current.play();
        }

        if (this.videoRef.current) {
            this.videoRef.current.play();
        }
    }

    pause() {
        if (this.audioRef.current) {
            this.audioRef.current.pause();
        }

        if (this.videoRef.current) {
            this.videoRef.current.pause();
        }
    }
}