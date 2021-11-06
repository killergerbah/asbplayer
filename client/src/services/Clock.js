export default class Clock {
    constructor() {
        this.accumulated = 0;
        this.started = false;
    }

    time(max) {
        if (this.started) {
            return Math.min(max, this.accumulated + Date.now() - this.startTime);
        }

        return Math.min(max, this.accumulated);
    }

    stop() {
        if (!this.started) {
            return;
        }

        this.started = false;
        this.accumulated += Date.now() - this.startTime;
    }

    start() {
        this.startTime = Date.now();
        this.started = true;
    }

    setTime(time) {
        if (this.started) {
            this.startTime = Date.now();
            this.accumulated = time;
        } else {
            this.accumulated = time;
        }
    }

    progress(max) {
        return max === 0 ? 0 : Math.min(1, this.time(max) / max);
    }
}
