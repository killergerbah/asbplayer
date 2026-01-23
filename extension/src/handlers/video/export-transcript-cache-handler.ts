import type { Command, Message, ExportTranscriptCacheMessage, ExportTranscriptCacheResponse } from '@project/common';
import { getAllCachedTranscripts } from '@/services/transcript-cache';

export default class ExportTranscriptCacheHandler {
    get sender() {
        return 'asbplayer-popup';
    }

    get command() {
        return 'export-transcript-cache';
    }

    handle(
        command: Command<Message>,
        sender: Browser.runtime.MessageSender,
        sendResponse: (r?: ExportTranscriptCacheResponse) => void
    ) {
        this._handleRequest(sendResponse);
        return true;
    }

    private async _handleRequest(sendResponse: (r?: ExportTranscriptCacheResponse) => void) {
        try {
            const transcripts = await getAllCachedTranscripts();
            const json = JSON.stringify(transcripts, null, 2);
            sendResponse({ json, count: transcripts.length });
        } catch (error) {
            console.error('Failed to export transcript cache:', error);
            sendResponse({ json: '[]', count: 0 });
        }
    }
}
