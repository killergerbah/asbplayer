import type { Command, Message, SupadataGenerateMessage, SupadataGenerateResponse } from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { getCachedTranscript, cacheTranscript } from '@/services/transcript-cache';

interface TranscriptRequest {
    url: string;
    language?: string;
}

interface TranscriptResponse {
    srt: string;
}

export default class SupadataGenerateHandler {
    private readonly _settings: SettingsProvider;

    constructor(settings: SettingsProvider) {
        this._settings = settings;
    }

    get sender() {
        return 'asbplayer-video-tab';
    }

    get command() {
        return 'supadata-generate';
    }

    handle(
        command: Command<Message>,
        sender: Browser.runtime.MessageSender,
        sendResponse: (r?: SupadataGenerateResponse) => void
    ) {
        const message = command.message as SupadataGenerateMessage;

        this._handleRequest(message.videoUrl, sendResponse);

        return true;
    }

    private async _handleRequest(
        videoUrl: string,
        sendResponse: (r?: SupadataGenerateResponse) => void
    ) {
        // Check cache first
        try {
            const cached = await getCachedTranscript(videoUrl);
            if (cached) {
                sendResponse({ subtitles: cached });
                return;
            }
        } catch (error) {
            // Cache error is not fatal, continue to generate
            console.error('Cache lookup failed:', error);
        }

        // Not in cache, generate from server
        const settings = await this._settings.get(['transcriptServerUrl', 'transcriptApiKey']);

        if (!settings.transcriptServerUrl) {
            sendResponse({ error: 'Transcript server URL not configured' });
            return;
        }

        try {
            const subtitles = await this._generateSubtitles(
                videoUrl,
                settings.transcriptServerUrl,
                settings.transcriptApiKey
            );

            // Cache the result
            try {
                await cacheTranscript(videoUrl, subtitles);
            } catch (error) {
                console.error('Failed to cache transcript:', error);
            }

            sendResponse({ subtitles });
        } catch (error) {
            sendResponse({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    private async _generateSubtitles(videoUrl: string, serverUrl: string, apiKey: string): Promise<string> {
        const endpoint = `${serverUrl.replace(/\/$/, '')}/transcript`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (apiKey) {
            headers['X-API-Key'] = apiKey;
        }

        const body: TranscriptRequest = {
            url: videoUrl,
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.detail || `Server error: ${response.status}`;
            throw new Error(errorMessage);
        }

        const data = (await response.json()) as TranscriptResponse;
        return data.srt;
    }
}
