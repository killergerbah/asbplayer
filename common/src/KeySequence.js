const REJECTED = 0;
const CANCELED = 1;
const ADVANCED = 2;
const COMPLETE = 3;

export default class KeySequence {
    constructor({ up, holding, canceledBy, map }) {
        this.up = up || [];
        this.holding = holding || [];
        this.canceledBy = canceledBy || [];
        this.map = map || (() => true);
        this.currentlyHolding = {};
        this.canceled = false;
    }

    static get REJECTED() {
        return REJECTED;
    }

    static get CANCELED() {
        return CANCELED;
    }

    static get ADVANCED() {
        return ADVANCED;
    }

    static get COMPLETE() {
        return COMPLETE;
    }

    reset() {
        this.currentlyHolding = {};
        this.canceled = false;
    }

    accept(event) {
        let result = REJECTED;
        let extra = null;

        if (event.type === 'keydown') {
            if (this.holding.includes(event.keyCode)) {
                this.currentlyHolding[event.keyCode] = true;
                this.canceled = false;
                result = ADVANCED;
            }

            if (this.canceledBy.includes(event.keyCode)) {
                this.canceled = true;
                result = CANCELED;
            }

            if (this.up.includes(event.keyCode)) {
                this.canceled = false;
                result = ADVANCED;
            }
        }

        if (event.type === 'keyup') {
            delete this.currentlyHolding[event.keyCode];

            if (this.up.includes(event.keyCode) && this._holdingAll() && !this.canceled) {
                extra = this.map(event);
                result = COMPLETE;
            }
        }

        return { result: result, extra: extra };
    }

    _holdingAll() {
        for (const key of this.holding) {
            if (!(key in this.currentlyHolding)) {
                return false;
            }
        }

        return true;
    }
}
