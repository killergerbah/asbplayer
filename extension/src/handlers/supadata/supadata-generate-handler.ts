import type { Command, Message, SupadataGenerateMessage, SupadataGenerateResponse } from '@project/common';
import { SettingsProvider } from '@project/common/settings';

interface SupadataChunk {
    start: number;
    end: number;
    text: string;
}

interface SupadataTranscriptResponse {
    content: SupadataChunk[];
}

interface SupadataJobResponse {
    jobId: string;
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

        this._settings.getSingle('supadataApiKey').then(async (apiKey) => {
            if (!apiKey) {
                sendResponse({ error: 'Supadata API key not configured' });
                return;
            }

            try {
                const subtitles = await this._generateSubtitles(message.videoUrl, apiKey);
                sendResponse({ subtitles });
            } catch (error) {
                sendResponse({
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });

        return true;
    }

    private async _generateSubtitles(videoUrl: string, apiKey: string): Promise<string> {
        const apiUrl = `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(videoUrl)}&mode=generate&text=false`;

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
            },
        });

        if (response.status === 202) {
            // Job is being processed, need to poll
            const jobData = (await response.json()) as SupadataJobResponse;
            return await this._pollForResult(jobData.jobId, apiKey);
        }

        if (!response.ok) {
            throw new Error(this._formatApiError(response.status, await response.text()));
        }

        const data = (await response.json()) as SupadataTranscriptResponse;
        return this._convertToSrt(data.content);
    }

    private async _pollForResult(jobId: string, apiKey: string): Promise<string> {
        const pollUrl = `https://api.supadata.ai/v1/transcript/job/${jobId}`;
        const maxAttempts = 60; // 2 minutes with 2 second intervals
        const pollInterval = 2000;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await this._sleep(pollInterval);

            const response = await fetch(pollUrl, {
                method: 'GET',
                headers: {
                    'x-api-key': apiKey,
                },
            });

            if (response.status === 202) {
                // Still processing
                continue;
            }

            if (!response.ok) {
                throw new Error(this._formatApiError(response.status, await response.text()));
            }

            const data = (await response.json()) as SupadataTranscriptResponse;
            return this._convertToSrt(data.content);
        }

        throw new Error('Subtitle generation timed out. The video may be too long or the service is overloaded. Please try again later.');
    }

    private _sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private _convertToSrt(chunks: SupadataChunk[]): string {
        return chunks
            .map((chunk, index) => {
                const startTime = this._formatSrtTime(chunk.start);
                const endTime = this._formatSrtTime(chunk.end);
                return `${index + 1}\n${startTime} --> ${endTime}\n${chunk.text}\n`;
            })
            .join('\n');
    }

    private _formatSrtTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const millis = Math.round((seconds % 1) * 1000);

        return `${this._pad(hours, 2)}:${this._pad(minutes, 2)}:${this._pad(secs, 2)},${this._pad(millis, 3)}`;
    }

    private _pad(num: number, length: number): string {
        return num.toString().padStart(length, '0');
    }

    private _formatApiError(status: number, responseText: string): string {
        // Handle common HTTP error codes with user-friendly messages
        switch (status) {
            case 401:
                return 'Invalid Supadata API key. Please check your API key in settings.';
            case 403:
                return 'Access denied. Your Supadata API key may not have permission for this operation.';
            case 404:
                return 'Video not found or not supported by Supadata.';
            case 429:
                return 'Rate limit exceeded. Please wait a moment and try again.';
            case 500:
                return 'Supadata server error. Please try again later.';
            case 502:
                return 'Supadata service temporarily unavailable. Please try again later.';
            case 503:
                return 'Supadata service is overloaded. Please try again later.';
            case 524:
                return 'Supadata request timed out. The video may be too long or the service is overloaded. Please try again later.';
            default:
                // If response looks like HTML, extract a simpler error
                if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
                    return `Supadata API error (${status}). The service may be temporarily unavailable.`;
                }
                // Try to parse JSON error message
                try {
                    const errorJson = JSON.parse(responseText);
                    if (errorJson.message) {
                        return `Supadata: ${errorJson.message}`;
                    }
                    if (errorJson.error) {
                        return `Supadata: ${errorJson.error}`;
                    }
                } catch {
                    // Not JSON, use truncated text
                    if (responseText.length > 100) {
                        return `Supadata API error (${status})`;
                    }
                }
                return `Supadata API error (${status}): ${responseText}`;
        }
    }
}
