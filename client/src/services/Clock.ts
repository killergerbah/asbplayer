export default class Clock {
    private accumulated: number;
    private started: boolean;
    private startTime?: number;

    constructor() {
        this.accumulated = 0;
        this.started = false;
    }

    time(max: number) {
        if (this.started) {
            return Math.min(max, this.accumulated + Date.now() - this.startTime!);
        }

        return Math.min(max, this.accumulated);
    }

    stop() {
        if (!this.started) {
            return;
        }

        this.started = false;
        this.accumulated += Date.now() - this.startTime!;
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
