import type { SubtitleGenerationMessage, SubtitleGenerationResponse } from '@project/common';

export const whisperServerUrl = 'http://127.0.0.1:8767';

export interface WhisperServerConfiguration {
    readonly url: string;
    readonly authToken: string;
}

const isLoopbackHost = (hostname: string) => ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname);

const configuredServer = (configuration: WhisperServerConfiguration) => {
    let url: URL;
    try {
        url = new URL(configuration.url.trim());
    } catch {
        return { error: 'Enter a valid Whisper service URL.' };
    }

    if (url.username || url.password || url.search || url.hash || (url.pathname !== '' && url.pathname !== '/')) {
        return { error: 'The Whisper service URL must not include a path, query, or fragment.' };
    }

    const loopback = isLoopbackHost(url.hostname);
    if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
        return { error: 'Remote Whisper services must use an HTTPS URL.' };
    }
    if (!loopback && !configuration.authToken.trim()) {
        return { error: 'An authorization token is required for a remote Whisper service.' };
    }

    return { baseUrl: url.origin, loopback };
};

const responseError = (error: unknown, baseUrl: string, loopback: boolean): SubtitleGenerationResponse => {
    if (error instanceof TypeError && /failed to fetch/i.test(error.message)) {
        return loopback
            ? {
                  error: 'Cannot reach the local Whisper service at 127.0.0.1:8767. Install and start asbplayer-whisper-server, then try again.',
              }
            : {
                  error: `Cannot reach the remote Whisper service at ${baseUrl}. Check that its Colab runtime and secure tunnel are still running.`,
              };
    }

    return { error: error instanceof Error ? error.message : String(error) };
};

const authorizedRequest = (init: RequestInit | undefined, authToken: string): RequestInit | undefined => {
    if (!authToken.trim()) return init;
    return {
        ...init,
        headers: {
            ...(init?.headers ?? {}),
            Authorization: `Bearer ${authToken.trim()}`,
        },
    };
};

const fetchJson = async (baseUrl: string, authToken: string, path: string, init?: RequestInit) => {
    const response = await fetch(`${baseUrl}${path}`, authorizedRequest(init, authToken));
    const contentType = response.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json') ? await response.json() : { error: await response.text() };

    if (!response.ok) {
        throw new Error(body.error || body.detail || `Whisper service returned ${response.status}`);
    }

    return body;
};

const validSourceUrl = (sourceUrl: string | undefined) => {
    if (!sourceUrl) return false;

    try {
        return ['http:', 'https:'].includes(new URL(sourceUrl).protocol);
    } catch {
        return false;
    }
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
};

/**
 * The service is deliberately accessed only by the extension background. Page
 * frames cannot make loopback or authenticated remote requests, which prevents
 * page CSP and CORS from affecting subtitle generation.
 */
export const requestWhisperServer = async (
    message: SubtitleGenerationMessage,
    configuration: WhisperServerConfiguration = { url: whisperServerUrl, authToken: '' }
): Promise<SubtitleGenerationResponse> => {
    const server = configuredServer(configuration);
    if ('error' in server) return { error: server.error };

    try {
        switch (message.operation) {
            case 'capabilities':
                return { capabilities: await fetchJson(server.baseUrl, configuration.authToken, '/v1/capabilities') };
            case 'cached': {
                if (!validSourceUrl(message.sourceUrl)) return { error: 'A valid video URL is required.' };
                const query = new URLSearchParams({ sourceUrl: message.sourceUrl! });
                return { entries: await fetchJson(server.baseUrl, configuration.authToken, `/v1/cache?${query}`) };
            }
            case 'start': {
                if (!validSourceUrl(message.sourceUrl)) return { error: 'A valid video URL is required.' };
                return {
                    job: await fetchJson(server.baseUrl, configuration.authToken, '/v1/jobs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sourceUrl: message.sourceUrl,
                            whisperOptions: message.whisperOptions ?? {},
                        }),
                    }),
                };
            }
            case 'status':
                if (!message.jobId) return { error: 'A subtitle generation job ID is required.' };
                return {
                    job: await fetchJson(
                        server.baseUrl,
                        configuration.authToken,
                        `/v1/jobs/${encodeURIComponent(message.jobId)}`
                    ),
                };
            case 'cancel':
                if (!message.jobId) return { error: 'A subtitle generation job ID is required.' };
                return {
                    job: await fetchJson(
                        server.baseUrl,
                        configuration.authToken,
                        `/v1/jobs/${encodeURIComponent(message.jobId)}`,
                        { method: 'DELETE' }
                    ),
                };
            case 'download': {
                if (!message.cacheEntryId) return { error: 'A generated subtitle cache ID is required.' };
                const response = await fetch(
                    `${server.baseUrl}/v1/cache/${encodeURIComponent(message.cacheEntryId)}/srt`,
                    authorizedRequest(undefined, configuration.authToken)
                );
                if (!response.ok)
                    throw new Error((await response.text()) || `Whisper service returned ${response.status}`);
                const disposition = response.headers.get('content-disposition') ?? '';
                const fileName = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'generated-subtitles.srt';
                return { srtBase64: arrayBufferToBase64(await response.arrayBuffer()), fileName };
            }
        }
    } catch (error) {
        return responseError(error, server.baseUrl, server.loopback);
    }
};
