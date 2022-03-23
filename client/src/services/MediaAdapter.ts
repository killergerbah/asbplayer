import { RefObject } from "react";

export default class MediaAdapter {
    private readonly ref: RefObject<HTMLMediaElement>;
    private readonly readyResolves: (() => void)[];

    constructor(ref: RefObject<HTMLMediaElement>) {
        this.ref = ref;
        this.readyResolves = [];
    }

    async seek(time: number) {
        return new Promise((resolve, reject) => {
            if (this.ref.current) {
                this.ref.current.currentTime = time;
                this._onMediaCanPlay(() => resolve(undefined));
            } else {
                resolve(undefined);
            }
        });
    }

    async onReady() {
        return new Promise((resolve, reject) => {
            if (this.ref.current) {
                this._onMediaCanPlay(() => resolve(undefined));
            } else {
                resolve(undefined);
            }
        });
    }

    _onMediaCanPlay(callback: () => void) {
        if (this.ref.current?.readyState === 4) {
            callback();
            return;
        }

        if (this.ref.current && !this.ref.current.oncanplay) {
            this.ref.current.oncanplay = (e) => {
                for (const resolve of this.readyResolves) {
                    resolve();
                }

                this.readyResolves.length = 0;

                if (this.ref.current) {
                    this.ref.current.oncanplay = null;
                }
            };
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
