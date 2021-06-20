export default class Bridge {

    onStateUpdated(uiListener) {
        this.uiListener = uiListener;
        return () => this.uiListener = null;
    }

    updateState(state) {
        setTimeout(() => this.uiListener?.(state), 0);
    }

    onFetch(fetchDelegate) {
        this.fetchDelegate = fetchDelegate;
    }

    async fetch(url, body) {
        if (!this.fetchDelegate) {
            throw new Error("Unable to fetch because no delegate is set");
        }

        return await this.fetchDelegate(url, body);
    }

    onFinished(clientListener) {
        this.clientListener = clientListener;
    }

    finished(message) {
        this.clientListener?.(message);
    }

    unbind() {
        this.uiListener = null;
        this.clientListener = null;
        this.fetchDelegate = null;
    }
}