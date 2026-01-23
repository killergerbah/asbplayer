import type { Command, Message } from '@project/common';
import { getTranscriptCacheCount } from '@/services/transcript-cache';

export interface GetTranscriptCacheCountResponse {
    readonly count: number;
}

export default class GetTranscriptCacheCountHandler {
    get sender() {
        return 'asbplayer-popup';
    }

    get command() {
        return 'get-transcript-cache-count';
    }

    handle(
        command: Command<Message>,
        sender: Browser.runtime.MessageSender,
        sendResponse: (r?: GetTranscriptCacheCountResponse) => void
    ) {
        this._handleRequest(sendResponse);
        return true;
    }

    private async _handleRequest(sendResponse: (r?: GetTranscriptCacheCountResponse) => void) {
        try {
            const count = await getTranscriptCacheCount();
            sendResponse({ count });
        } catch (error) {
            console.error('Failed to get transcript cache count:', error);
            sendResponse({ count: 0 });
        }
    }
}
