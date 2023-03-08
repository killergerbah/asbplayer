import FrameBridgeClient, { FetchOptions } from './FrameBridgeClient';

export default class UiFrame {
    readonly frame: HTMLIFrameElement;
    private readonly _client: FrameBridgeClient;
    private readonly _html: string;
    private _bound = false;

    constructor(html: string, fetchOptions?: FetchOptions) {
        this.frame = document.createElement('iframe');
        this.frame.className = 'asbplayer-ui-frame';

        // Prevent iframe from showing up with solid background
        // https://stackoverflow.com/questions/69591128/chrome-is-forcing-a-white-background-on-frames-only-on-some-websites
        this.frame.style.colorScheme = 'normal';
        
        this._client = new FrameBridgeClient(this.frame, fetchOptions);
        this._html = html;
    }

    get bound() {
        return this._bound;
    }

    get hidden() {
        return this.frame.classList.contains('asbplayer-hide');
    }

    async bind() {
        if (this._bound) {
            return;
        }

        document.body.appendChild(this.frame);
        const doc = this.frame.contentDocument!;
        doc.open();
        doc.write(this._html);
        doc.close();
        this._bound = true;
        await this._client.bind();
    }

    async client() {
        await this._client.bind();
        return this._client;
    }

    show() {
        this.frame.classList.remove('asbplayer-hide');
    }

    hide() {
        this.frame.classList.add('asbplayer-hide');
    }

    unbind() {
        this._client.unbind();
        this.frame.remove();
        this._bound = false;
    }
}
