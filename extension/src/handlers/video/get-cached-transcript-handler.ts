import type { Command, Message, GetCachedTranscriptMessage, GetCachedTranscriptResponse } from '@project/common';
import { getCachedTranscript } from '@/services/transcript-cache';

export default class GetCachedTranscriptHandler {
    get sender() {
        return 'asbplayer-video-tab';
    }

    get command() {
        return 'get-cached-transcript';
    }

    handle(
        command: Command<Message>,
        sender: Browser.runtime.MessageSender,
        sendResponse: (r?: GetCachedTranscriptResponse) => void
    ) {
        const message = command.message as GetCachedTranscriptMessage;

        this._handleRequest(message.videoUrl, sendResponse);

        return true;
    }

    private async _handleRequest(
        videoUrl: string,
        sendResponse: (r?: GetCachedTranscriptResponse) => void
    ) {
        try {
            const cached = await getCachedTranscript(videoUrl);
            sendResponse({ subtitles: cached ?? undefined });
        } catch (error) {
            console.error('Failed to get cached transcript:', error);
            sendResponse({});
        }
    }
}
