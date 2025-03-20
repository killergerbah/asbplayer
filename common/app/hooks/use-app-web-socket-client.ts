import { WebSocketClientSettings } from '../../settings';
import { CardTextFieldValues, PostMineAction } from '../../src/model';
import { WebSocketClient } from '../../web-socket-client';
import { useEffect, useState } from 'react';

export interface MineSubtitleParams extends CardTextFieldValues {
    postMineAction: PostMineAction;
}

export const useAppWebSocketClient = ({ settings }: { settings: WebSocketClientSettings }) => {
    const [client, setClient] = useState<WebSocketClient>();

    useEffect(() => {
        if (settings.webSocketClientEnabled && settings.webSocketServerUrl) {
            const client = new WebSocketClient();
            client.bind(settings.webSocketServerUrl).catch(console.error);
            setClient(client);
            return () => client.unbind();
        }

        setClient(undefined);
    }, [settings.webSocketServerUrl, settings.webSocketClientEnabled]);

    return client;
};
