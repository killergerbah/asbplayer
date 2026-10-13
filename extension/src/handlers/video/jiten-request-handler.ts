import type { Command, JitenRequestMessage, Message } from '@project/common';
import { base64ToBlob } from '@project/common/base64';
import type { SettingsProvider } from '@project/common/settings';
import { getJitenClient } from '@project/extension/src/services/jiten-client';

export default class JitenRequestHandler {
    constructor(private readonly settings: SettingsProvider) {}

    get sender() {
        return ['asbplayer-video', 'asbplayer-video-tab', 'asbplayer-popup'];
    }
    get command() {
        return 'jiten-request';
    }

    handle(command: Command<Message>, _sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const message = command.message as JitenRequestMessage;
        void (async () => {
            const allowed =
                (message.method === 'GET' && /^\/user\/example-sentences\/\d+\/\d+$/.test(message.path)) ||
                (message.method === 'POST' &&
                    /^\/(reader\/lookup-vocabulary|srs\/card-media\/batch|srs\/card-media\/\d+\/\d+|srs\/study-decks\/\d+\/words|user\/example-sentences\/\d+\/\d+)$/.test(
                        message.path
                    )) ||
                (message.method === 'PUT' && /^\/user\/example-sentences\/\d+$/.test(message.path));
            if (!allowed) throw new Error('Unsupported Jiten request');
            let body: object | FormData | undefined = message.body ? JSON.parse(message.body) : undefined;
            if (message.file) {
                const multipart = new FormData();
                multipart.append('file', base64ToBlob(message.file.base64, message.file.type), message.file.name);
                body = multipart;
            }
            const client = await getJitenClient(this.settings);
            const response = await client.request(message.path, message.method, body);
            sendResponse({ text: JSON.stringify(response) });
        })().catch((error: Error) => sendResponse({ error: error.message }));
        return true;
    }
}
