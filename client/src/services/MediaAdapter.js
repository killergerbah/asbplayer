export default class MediaAdapter {

    constructor(ref) {
        this.ref = ref;
        this.readyResolves = [];
    }

    async seek(time) {
        return new Promise((resolve, reject) => {
            if (this.ref.current) {
                this.ref.current.currentTime = time;
                this._onMediaCanPlay(() => resolve());
            } else {
                resolve();
            }
        });
    }

    async onReady() {
        return new Promise((resolve, reject) => {
            if (this.ref.current) {
                this._onMediaCanPlay(() => resolve());
            } else {
                resolve();
            }
        });
    }

    _onMediaCanPlay(callback) {
        if (this.ref.readyState === 4) {
            callback();
            return;
        }

        if (this.ref.current && !this.ref.current.oncanplay) {
            this.ref.current.oncanplay = (e) => {
                for (const resolve of this.readyResolves) {
                    resolve();
                }

                this.readyResolves.length = 0;
                this.ref.current.oncanplay = null;
            }
        }


        this.readyResolves.push(callback);
    }

    play() {
        this.ref.current?.play();
    }

    pause() {
        this.ref.current?.pause();
    }
}