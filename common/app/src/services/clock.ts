export default class Clock {
    private _accumulated: number;
    private _started: boolean;
    private _startTime?: number;
    private _rate = 1;

    constructor() {
        this._accumulated = 0;
        this._started = false;
    }

    get running() {
        return this._started;
    }

    get rate() {
        return this._rate;
    }

    set rate(rate: number) {
        if (this._started) {
            this._accumulated += this._elapsed();
            this._startTime = Date.now();
        }
    
        this._rate = rate;
    }

    time(max: number) {
        if (this._started) {
            return Math.min(max, this._accumulated + this._elapsed());
        }

        return Math.min(max, this._accumulated);
    }

    stop() {
        if (!this._started) {
            return;
        }

        this._started = false;
        this._accumulated += this._elapsed();
    }

    private _elapsed() {
        return (Date.now() - this._startTime!) * this._rate;
    }

    start() {
        this._startTime = Date.now();
        this._started = true;
    }

    setTime(time: number) {
        if (this._started) {
            this._startTime = Date.now();
            this._accumulated = time;
        } else {
            this._accumulated = time;
        }
    }

    progress(max: number) {
        return max === 0 ? 0 : Math.min(1, this.time(max) / max);
    }
}
