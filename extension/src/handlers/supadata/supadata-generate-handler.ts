import type { Command, Message, SupadataGenerateMessage, SupadataGenerateResponse } from '@project/common';
import { SettingsProvider } from '@project/common/settings';

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

        this._settings.get(['transcriptServerUrl', 'transcriptApiKey']).then(async (settings) => {
            if (!settings.transcriptServerUrl) {
                sendResponse({ error: 'Transcript server URL not configured' });
                return;
            }

            try {
                const subtitles = await this._generateSubtitles(
                    message.videoUrl,
                    settings.transcriptServerUrl,
                    settings.transcriptApiKey
                );
                sendResponse({ subtitles });
            } catch (error) {
                sendResponse({
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });

        return true;
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
