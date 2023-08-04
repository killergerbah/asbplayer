export default class OffscreenDomCache {
    private offscreenElement?: HTMLElement;
    private _cachedContentElements: { [key: string]: HTMLElement } = {};
    private _empty = true;

    constructor() {}

    public get empty() {
        return this._empty;
    }

    clear() {
        this.offscreenElement?.remove();
        this.offscreenElement = undefined;
        this._cachedContentElements = {};
        this._empty = true;
    }

    add(key: string, html: string) {
        const cached = document.createElement('div');
        cached.innerHTML = `${html}\n`;
        this._cachedContentElements[key] = cached;
        this._offscreenElement().appendChild(cached);
        this._empty = false;
    }

    return(element: HTMLElement) {
        this._offscreenElement().appendChild(element);
    }

    get(key: string, html?: () => string) {
        let cached = this._cachedContentElements[key];

        if (!cached) {
            if (html === undefined) {
                throw new Error(`Cached html not found for key ${key}`);
            }

            cached = document.createElement('div');
            cached.innerHTML = html();
            this._cachedContentElements[key] = cached;
            this._offscreenElement().appendChild(cached);
        }

        return cached;
    }

    private _offscreenElement() {
        if (this.offscreenElement) {
            return this.offscreenElement;
        }

        const element = document.createElement('div');
        element.className = 'asbplayer-offscreen';
        document.body.append(element);
        this.offscreenElement = element;
        return element;
    }
}
