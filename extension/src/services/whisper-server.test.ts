import { expect, it, jest, afterEach } from '@jest/globals';
import { requestWhisperServer, whisperServerUrl } from '@project/extension/src/services/whisper-server';

const fetchMock = jest.fn<typeof fetch>();
global.fetch = fetchMock;

afterEach(() => {
    fetchMock.mockReset();
});

const jsonResponse = (body: unknown, ok = true) =>
    ({
        ok,
        status: ok ? 200 : 422,
        headers: { get: () => 'application/json' },
        json: async () => body,
        text: async () => JSON.stringify(body),
    }) as unknown as Response;

it('rejects invalid generation URLs before they reach the local service', async () => {
    await expect(
        requestWhisperServer({ command: 'subtitle-generation', operation: 'start', sourceUrl: 'file:///movie.mp4' })
    ).resolves.toEqual({ error: 'A valid video URL is required.' });
    expect(fetchMock).not.toHaveBeenCalled();
});

it('requests cached subtitles from the default loopback service', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await expect(
        requestWhisperServer({
            command: 'subtitle-generation',
            operation: 'cached',
            sourceUrl: 'https://www.youtube.com/watch?v=test',
        })
    ).resolves.toEqual({ entries: [] });

    expect(fetchMock).toHaveBeenCalledWith(
        `${whisperServerUrl}/v1/cache?sourceUrl=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dtest`,
        undefined
    );
});

it('uses bearer authentication for a configured remote Whisper service', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ whisperVersion: 'test', options: [] }));

    await expect(
        requestWhisperServer(
            { command: 'subtitle-generation', operation: 'capabilities' },
            { url: 'https://example.trycloudflare.com', authToken: 'remote-secret' }
        )
    ).resolves.toEqual({ capabilities: { whisperVersion: 'test', options: [] } });

    expect(fetchMock).toHaveBeenCalledWith('https://example.trycloudflare.com/v1/capabilities', {
        headers: { Authorization: 'Bearer remote-secret' },
    });
});

it('requires an authenticated HTTPS endpoint for remote Whisper services', async () => {
    await expect(
        requestWhisperServer(
            { command: 'subtitle-generation', operation: 'capabilities' },
            { url: 'http://example.test', authToken: 'remote-secret' }
        )
    ).resolves.toEqual({ error: 'Remote Whisper services must use an HTTPS URL.' });
    await expect(
        requestWhisperServer(
            { command: 'subtitle-generation', operation: 'capabilities' },
            { url: 'https://example.test', authToken: '' }
        )
    ).resolves.toEqual({ error: 'An authorization token is required for a remote Whisper service.' });
    expect(fetchMock).not.toHaveBeenCalled();
});

it('turns service errors into selector-safe messages', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Unsupported source' }, false));

    await expect(requestWhisperServer({ command: 'subtitle-generation', operation: 'capabilities' })).resolves.toEqual({
        error: 'Unsupported source',
    });
});

it('explains how to recover when the local service is unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(requestWhisperServer({ command: 'subtitle-generation', operation: 'capabilities' })).resolves.toEqual({
        error: 'Cannot reach the local Whisper service at 127.0.0.1:8767. Install and start asbplayer-whisper-server, then try again.',
    });
});

it('explains when a configured remote service is unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
        requestWhisperServer(
            { command: 'subtitle-generation', operation: 'capabilities' },
            { url: 'https://example.trycloudflare.com', authToken: 'remote-secret' }
        )
    ).resolves.toEqual({
        error: 'Cannot reach the remote Whisper service at https://example.trycloudflare.com. Check that its Colab runtime and secure tunnel are still running.',
    });
});
