import { Command, Message } from '@project/common';

export interface CommandHandler {
    sender: string;
    command: string | null;
    handle: (
        command: Command<Message>,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => boolean | undefined | Promise<unknown>;
}
