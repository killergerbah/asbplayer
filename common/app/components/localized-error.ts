export class LocalizedError extends Error {
    private readonly key: string;
    private readonly params: { [key: string]: string };

    constructor(key: string, params: { [key: string]: string } = {}) {
        super(key);
        this.key = key;
        this.params = params;
    }

    get locKey() {
        return this.key;
    }

    get locParams() {
        return this.params;
    }
}
