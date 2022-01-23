import { Command, HttpPostMessage, Message } from '@project/common';

export default class HttpPostHandler {
    constructor() {}

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'http-post';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const message = command.message as HttpPostMessage;

        fetch(message.url, {
            method: 'POST',
            body: JSON.stringify(message.body),
        })
            .then((response) => response.json())
            .then((json) => sendResponse(json))
            .catch((e) => sendResponse({ error: e.message }));

        return true;
    }
}
