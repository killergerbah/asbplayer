export enum KeySequenceTransitionResult {
    REJECTED = 0,
    CANCELED = 1,
    ADVANCED = 2,
    COMPLETE = 3,
}

export interface KeySequenceOptions {
    up?: string[];
    holding?: string[];
    canceledBy?: string[];
    map?: (event: KeyboardEvent) => any;
}

export interface KeySequenceTransition {
    result: KeySequenceTransitionResult;
    extra?: any;
}

export default class KeySequence {
    private up: string[];
    private holding: string[];
    private canceledBy: string[];
    private map: (event: KeyboardEvent) => any;
    private currentlyHolding: { [key: string]: boolean };
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
            const key = event.key.toLowerCase();
            this.currentlyHolding[key] = true;

            if (this.holding.includes(key)) {
                this.canceled = false;
                result = KeySequenceTransitionResult.ADVANCED;
            } else if (!this.up.includes(key)) {
                this.canceled = true;
                result = KeySequenceTransitionResult.CANCELED;
            }

            if (this.canceledBy.includes(key)) {
                this.canceled = true;
                result = KeySequenceTransitionResult.CANCELED;
            }

            if (this._holdingAll() && !this._holdingCancelingKey() && this.up.includes(key)) {
                this.canceled = false;
                result = KeySequenceTransitionResult.ADVANCED;
            }
        }

        if (event.type === 'keyup') {
            const key = event.key.toLowerCase();
            delete this.currentlyHolding[key];

            if (this.up.includes(key) && this._holdingAll() && !this.canceled) {
                extra = this.map(event);
                result = KeySequenceTransitionResult.COMPLETE;
            }
        }

        return { result: result, extra: extra };
    }

    private _holdingCancelingKey() {
        for (const key of Object.keys(this.currentlyHolding)) {
            if (key in this.canceledBy) {
                return true;
            }
        }

        return false;
    }

    private _holdingAll() {
        for (const key of this.holding) {
            if (!(key in this.currentlyHolding)) {
                return false;
            }
        }

        return true;
    }
}
