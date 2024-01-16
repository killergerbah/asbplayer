export interface MineSubtitleCommand {
    command: 'mine-subtitle';
    messageId: string;
    body: {
        fields: { [key: string]: string };
        postMineAction: number;
    };
}

interface MineSubtitleResponse {
    command: 'response';
    messageId: string;
    body: {
        published: boolean;
    };
}

export class WebSocketClient {
    private _socket?: WebSocket;
    private _pingInterval?: NodeJS.Timeout;
    private _lastPingTimestampMs?: number;
    private _pongReceived: boolean = false;
    private _pingPromises: { resolve: (value: unknown) => void; reject: (error: any) => void }[] = [];
    private _connectPromise?: { resolve: (value: unknown) => void; reject: (error: any) => void };
    onMineSubtitle?: (command: MineSubtitleCommand) => Promise<boolean>;

    get socket() {
        return this._socket;
    }

    async bind(url: string) {
        if (this._pingInterval) {
            clearInterval(this._pingInterval);
        }

        this._pingInterval = setInterval(() => {
            if (this._lastPingTimestampMs !== undefined && !this._pongReceived) {
                console.log('Did not receive pong - reconnecting');

                for (const r of this._pingPromises) {
                    r.reject('Timed out');
                }

                this._pingPromises = [];
                this._connect(url);
            } else {
                this.ping();
            }
        }, 10000);

        await this._connect(url);
    }

    private async _connect(url: string) {
        this._disconnect();

        if (!url) {
            throw new Error('Invalid URL');
        }

        return new Promise((resolve, reject) => {
            this._connectPromise = { resolve, reject };
            const socket = new WebSocket(url);
            socket.onmessage = async (event) => {
                if (event.data === 'PONG') {
                    this._pongReceived = true;

                    for (const p of this._pingPromises) {
                        p.resolve(undefined);
                    }

                    this._pingPromises = [];
                } else {
                    const payload = JSON.parse(event.data);

                    if (payload.command === 'mine-subtitle') {
                        const messageId = payload.messageId;
                        const published = (await this.onMineSubtitle?.(payload)) ?? false;
                        const response: MineSubtitleResponse = { command: 'response', messageId, body: { published } };
                        this._socket?.send(JSON.stringify(response));
                    }
                }
            };
            socket.onclose = (event) => {
                console.log(`Socket closed - reason: ${event.reason}`);
                this._connectPromise?.reject('Socket closed');
                this._connectPromise = undefined;
            };
            socket.onerror = () => {
                console.log('Socket error');
                this._connectPromise?.reject('Socket error');
                this._connectPromise = undefined;
            };
            socket.onopen = () => {
                this.ping();
                this._connectPromise?.resolve(undefined);
                this._connectPromise = undefined;
            };

            this._socket = socket;
        });
    }

    async ping() {
        return new Promise((resolve, reject) => {
            if (!this._socket || this._socket.readyState !== this._socket.OPEN) {
                reject('Not connected');
                return;
            }

            this._socket.send('PING');
            this._lastPingTimestampMs = Date.now();
            this._pongReceived = false;
            this._pingPromises.push({ resolve, reject });
        });
    }

    private _disconnect() {
        if (!this._socket) {
            return;
        }

        if (this._socket.readyState !== this._socket.CLOSED && this._socket.readyState !== this._socket.CLOSING) {
            this._socket.close();
        }

        this._socket = undefined;
    }

    unbind() {
        this._disconnect();

        if (this._pingInterval !== undefined) {
            clearInterval(this._pingInterval);
            this._pingInterval = undefined;
        }

        for (const p of this._pingPromises) {
            p.reject('Disconnecting');
        }

        this._pingPromises = [];
        this._lastPingTimestampMs = undefined;
        this._pongReceived = false;
    }
}
