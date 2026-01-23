import type { Command, Message, ClearTranscriptCacheMessage, ClearTranscriptCacheResponse } from '@project/common';
import { clearTranscriptCache } from '@/services/transcript-cache';

export default class ClearTranscriptCacheHandler {
    get sender() {
        return 'asbplayer-popup';
    }

    get command() {
        return 'clear-transcript-cache';
    }

    handle(
        command: Command<Message>,
        sender: Browser.runtime.MessageSender,
        sendResponse: (r?: ClearTranscriptCacheResponse) => void
    ) {
        this._handleRequest(sendResponse);
        return true;
    }

    private async _handleRequest(sendResponse: (r?: ClearTranscriptCacheResponse) => void) {
        try {
            await clearTranscriptCache();
            sendResponse({ success: true });
        } catch (error) {
            console.error('Failed to clear transcript cache:', error);
            sendResponse({ success: false });
        }
    }
}
