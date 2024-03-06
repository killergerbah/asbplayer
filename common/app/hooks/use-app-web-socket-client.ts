import { AnkiSettings, WebSocketClientSettings, ankiSettingsKeys } from '../../settings';
import { CardTextFieldValues, PostMineAction } from '../../src/model';
import { MineSubtitleCommand, WebSocketClient } from '../../web-socket-client';
import { useEffect, useState } from 'react';
import { useDocumentHasFocus } from './use-document-has-focus';

export interface MineSubtitleParams extends CardTextFieldValues {
    postMineAction: PostMineAction;
}

export const useAppWebSocketClient = ({
    onMineSubtitle,
    settings,
    enabled,
}: {
    onMineSubtitle: (params: MineSubtitleParams) => boolean;
    settings: WebSocketClientSettings & AnkiSettings;
    enabled: boolean;
}) => {
    const [client, setClient] = useState<WebSocketClient>();
    const documentHasFocus = useDocumentHasFocus();

    useEffect(() => {
        if (enabled && settings.webSocketClientEnabled && settings.webSocketServerUrl && documentHasFocus) {
            const client = new WebSocketClient();
            client.bind(settings.webSocketServerUrl).catch(console.error);
            setClient(client);
            return () => client.unbind();
        }

        setClient(undefined);
    }, [documentHasFocus, settings.webSocketServerUrl, settings.webSocketClientEnabled, enabled]);

    useEffect(() => {
        if (!client) {
            return;
        }

        client.onMineSubtitle = async ({
            body: { fields: receivedFields, postMineAction: receivedPostMineAction },
        }: MineSubtitleCommand) => {
            const fields = receivedFields ?? {};
            const word = fields[settings.wordField] || undefined;
            const definition = fields[settings.definitionField] || undefined;
            const text = fields[settings.sentenceField] || undefined;
            const customFieldValues = Object.fromEntries(
                Object.entries(settings.customAnkiFields)
                    .map(([asbplayerFieldName, ankiFieldName]) => {
                        const fieldValue = fields[ankiFieldName];

                        if (fieldValue === undefined) {
                            return undefined;
                        }

                        return [asbplayerFieldName, fieldValue];
                    })
                    .filter((entry) => entry !== undefined) as string[][]
            );
            const postMineAction = receivedPostMineAction ?? PostMineAction.showAnkiDialog;
            return onMineSubtitle({ postMineAction, text, word, definition, customFieldValues });
        };
    }, [
        client,
        settings.wordField,
        settings.definitionField,
        settings.sentenceField,
        settings.customAnkiFields,
        onMineSubtitle,
    ]);
};
