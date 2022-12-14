export default class Clock {
    private accumulated: number;
    private started: boolean;
    private startTime?: number;
    private _rate = 1;

    constructor() {
        this.accumulated = 0;
        this.started = false;
    }

    get rate() {
        return this._rate;
    }

    set rate(rate: number) {
        this.accumulated += this._elapsed();
        this.startTime = Date.now();
        this._rate = rate;
    }

    time(max: number) {
        if (this.started) {
            return Math.min(max, this.accumulated + this._elapsed());
        }

        return Math.min(max, this.accumulated);
    }

    stop() {
        if (!this.started) {
            return;
        }

        this.started = false;
        this.accumulated += this._elapsed();
    }

    private _elapsed() {
        return (Date.now() - this.startTime!) * this._rate;
    }

    start() {
        this.startTime = Date.now();
        this.started = true;
    }

    setTime(time: number) {
        if (this.started) {
            this.startTime = Date.now();
            this.accumulated = time;
        } else {
            this.accumulated = time;
        }
    }

    progress(max: number) {
        return max === 0 ? 0 : Math.min(1, this.time(max) / max);
    }
}
