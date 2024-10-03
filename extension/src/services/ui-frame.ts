import { isFirefoxBuild } from './build-flags';
import FrameBridgeClient, { FetchOptions } from './frame-bridge-client';

const frameColorScheme = () => {
    // Prevent iframe from showing up with solid background by selecting suitable color scheme according to document's color scheme
    // https://fvsch.com/transparent-iframes

    const documentColorSchemeMetaTag = document.querySelector('meta[name="color-scheme"]');

    if (documentColorSchemeMetaTag === null) {
        return 'normal';
    }

    const documentColorScheme = (documentColorSchemeMetaTag as HTMLMetaElement).content;
    const light = documentColorScheme.includes('light');
    const dark = documentColorScheme.includes('dark');

    if (light && dark) {
        return 'none';
    }

    if (light) {
        return 'light';
    }

    if (dark) {
        return 'dark';
    }

    return 'normal';
};

export default class UiFrame {
    private readonly _html: (lang: string) => Promise<string>;
    private _fetchOptions: FetchOptions | undefined;
    private _client: FrameBridgeClient | undefined;
    private _frame: HTMLIFrameElement | undefined;
    private _language: string = 'en';
    private _dirty = true;
    private _bound = false;

    constructor(html: (lang: string) => Promise<string>) {
        this._html = html;
    }

    set fetchOptions(fetchOptions: FetchOptions) {
        this._dirty =
            this._dirty ||
            this._fetchOptions?.allowedFetchUrl !== fetchOptions.allowedFetchUrl ||
            this._fetchOptions?.videoSrc !== fetchOptions.videoSrc;
        this._fetchOptions = fetchOptions;
    }

    set language(language: string) {
        this._dirty = this._dirty || this._language !== language;
        this._language = language;
    }

    get hidden() {
        return this._frame === undefined || this._frame.classList.contains('asbplayer-hide');
    }

    get bound() {
        return this._bound;
    }

    get frame() {
        return this._frame;
    }

    get clientIfLoaded() {
        return this._client;
    }

    async bind(): Promise<boolean> {
        return await this._init();
    }

    async client() {
        await this._init();
        return this._client!;
    }

    private async _init() {
        if (!this._dirty) {
            return false;
        }

        this._dirty = false;
        this._bound = true;
        this._client?.unbind();
        this._frame?.remove();

        this._frame = document.createElement('iframe');
        this._frame.className = 'asbplayer-ui-frame';

        this._frame.style.colorScheme = frameColorScheme();
        this._frame.setAttribute('allowtransparency', 'true');

        this._client = new FrameBridgeClient(this._frame, this._fetchOptions);
        document.body.appendChild(this._frame);

        if (isFirefoxBuild) {
            // Firefox does not allow document.write() into the about:blank iframe.
            // CSP headers are modified using the webRequest API to allow extension scripts to
            // be loaded.
            this._frame.srcdoc = await this._html(this._language);
        } else {
            // On Chromium, use document.write() since it allows the loading of extension scripts
            // into the iframe without additional work.
            const doc = this._frame.contentDocument!;
            doc.open();
            doc.write(await this._html(this._language));
            doc.close();
        }

        await this._client!.bind();
        return true;
    }

    show() {
        this._frame?.classList.remove('asbplayer-hide');
    }

    hide() {
        this._frame?.classList.add('asbplayer-hide');
        this._frame?.blur();
    }

    unbind() {
        this._dirty = true;
        this._client?.unbind();
        this._frame?.remove();
    }
}
