export enum KeySequenceTransitionResult {
    REJECTED = 0,
    CANCELED = 1,
    ADVANCED = 2,
    COMPLETE = 3,
}

export interface KeySequenceOptions {
    up?: number[];
    holding?: number[];
    canceledBy?: number[];
    map?: (event: KeyboardEvent) => any;
}

export interface KeySequenceTransition {
    result: KeySequenceTransitionResult;
    extra?: any;
}

export default class KeySequence {
    private up: number[];
    private holding: number[];
    private canceledBy: number[];
    private map: (event: KeyboardEvent) => any;
    private currentlyHolding: { [key: number]: boolean };
    private canceled: boolean;

    constructor({ up, holding, canceledBy, map }: KeySequenceOptions) {
        this.up = up || [];
        this.holding = holding || [];
        this.canceledBy = canceledBy || [];
        this.map = map || ((event: KeyboardEvent) => true);
        this.currentlyHolding = {};
        this.canceled = false;
    }

    reset() {
        this.currentlyHolding = {};
        this.canceled = false;
    }

    accept(event: KeyboardEvent): KeySequenceTransition {
        let result = KeySequenceTransitionResult.REJECTED;
        let extra = null;

        if (event.type === 'keydown') {
            if (this.holding.includes(event.keyCode)) {
                this.currentlyHolding[event.keyCode] = true;
                this.canceled = false;
                result = KeySequenceTransitionResult.ADVANCED;
            }

            if (this.canceledBy.includes(event.keyCode)) {
                this.canceled = true;
                result = KeySequenceTransitionResult.CANCELED;
            }

            if (this.up.includes(event.keyCode)) {
                this.canceled = false;
                result = KeySequenceTransitionResult.ADVANCED;
            }
        }

        if (event.type === 'keyup') {
            delete this.currentlyHolding[event.keyCode];

            if (this.up.includes(event.keyCode) && this._holdingAll() && !this.canceled) {
                extra = this.map(event);
                result = KeySequenceTransitionResult.COMPLETE;
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
