export default function Clock() {
    this.accumulated = 0;
    this.started = false;

    this.time = (max) => {
        if (this.started) {
            return Math.min(max, this.accumulated + Date.now() - this.startTime);
        }

        return Math.min(max, this.accumulated);
    };

    this.stop = () => {
        if (!this.started) {
            return;
        }

        this.started = false;
        this.accumulated += Date.now() - this.startTime;
    };

    this.start = () => {
        this.startTime = Date.now();
        this.started = true;
    };

    this.setTime = (time) => {
        if (this.started) {
            this.startTime = Date.now();
            this.accumulated = time;
        } else {
            this.accumulated = time;
        }
    };

    this.progress = (max) => {
        return max === 0 ? 0 : Math.min(1, this.time(max) / max);
    }
}