export default class Bridge {
    private uiListener?: (state: any) => void;
    private clientListener?: (message: any) => void;
    private fetchDelegate?: (url: string, body: any) => Promise<void>;

    onStateUpdated(uiListener: (state: any) => void) {
        this.uiListener = uiListener;
        return () => {
            this.uiListener = undefined;
        };
    }

    updateState(state: any) {
        setTimeout(() => this.uiListener?.(state), 0);
    }

    onFetch(fetchDelegate: (url: string, body: any) => Promise<void>) {
        this.fetchDelegate = fetchDelegate;
    }

    async fetch(url: string, body: any) {
        if (!this.fetchDelegate) {
            throw new Error('Unable to fetch because no delegate is set');
        }

        return await this.fetchDelegate(url, body);
    }

    onFinished(clientListener: (message: any) => void) {
        this.clientListener = clientListener;
    }

    finished(message: any) {
        this.clientListener?.(message);
    }

    unbind() {
        this.uiListener = undefined;
        this.clientListener = undefined;
        this.fetchDelegate = undefined;
    }
}
