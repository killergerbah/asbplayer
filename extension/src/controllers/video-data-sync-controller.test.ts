import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { SubtitleHtml, VideoDataUiOpenReason } from '@project/common';
import type { ConfirmedVideoDataSubtitleTrack, VideoDataUiBridgeConfirmMessage } from '@project/common';
import { defaultSettings } from '@project/common/settings';
import type { SettingsProvider } from '@project/common/settings';
import { SubtitleReader } from '@project/common/subtitle-reader';
import VideoDataSyncController from '@project/extension/src/controllers/video-data-sync-controller';
import type Binding from '@/services/binding';

// Load the actual ESM parsers with Node's loader; Jest does not transform them.
jest.mock('@qgustavor/srt-parser', () =>
    process.getBuiltinModule('module').createRequire(require.resolve('@project/common/package.json'))(
        '@qgustavor/srt-parser'
    )
);
jest.mock('ass-compiler', () =>
    process.getBuiltinModule('module').createRequire(require.resolve('@project/common/package.json'))('ass-compiler')
);
jest.mock('@/services/extension-global-state-provider', () => ({
    ExtensionGlobalStateProvider: class {
        async get() {
            return { ftueHasSeenSubtitleTrackSelector: true, genericSubtitleParser: { pages: {} } };
        }
    },
}));
jest.mock('@/services/pages', () => ({
    currentPageDelegate: async () => ({ config: {}, isVideoPage: () => true, canAutoSync: () => true }),
}));
jest.mock('@/services/localization-fetcher', () => ({ fetchLocalization: async () => ({}) }));
jest.mock('@/services/ui-frame', () => ({ uiFrameForHtml: () => mockFrame }));
jest.mock('@/services/tutorial', () => ({ isOnTutorialPage: () => false }));

let mockConfirm: (message: VideoDataUiBridgeConfirmMessage) => void;
const mockClient = {
    onMessage: (listener: typeof mockConfirm) => {
        mockConfirm = listener;
    },
    updateState: () => {},
};
const mockFrame = {
    hidden: true,
    bind: async () => true,
    client: async () => mockClient,
    show() {
        this.hidden = false;
    },
    hide() {
        this.hidden = true;
    },
    unbind: () => {},
};

const readBlob = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(blob);
    });
Object.defineProperty(File.prototype, 'text', {
    configurable: true,
    value: function (this: File) {
        return readBlob(this);
    },
});

const track = (language: string, url: string | string[]): ConfirmedVideoDataSubtitleTrack => ({
    id: language,
    name: language,
    language,
    url,
    extension: 'vtt',
    label: language,
});
const cue = (text: string, start = '00:00:01.000', end = '00:00:02.000') =>
    `WEBVTT\n\n${start} --> ${end}\n${text}\n\n`;

describe('segmented subtitle track selection', () => {
    const controllers: VideoDataSyncController[] = [];
    afterEach(() => {
        controllers.splice(0).forEach((controller) => controller.unbind());
        jest.restoreAllMocks();
        jest.useRealTimers();
        mockFrame.hidden = true;
    });

    const loadSelection = async (data: ConfirmedVideoDataSubtitleTrack[], auto = false) => {
        const reader = new SubtitleReader({
            regexFilter: '',
            regexFilterTextReplacement: '',
            subtitleHtml: SubtitleHtml.render,
            convertNetflixRuby: false,
            pgsParserWorkerFactory: async () => {
                throw new Error('Not PGS');
            },
        });
        const loaded: { files: File[]; flatten: boolean; subtitles: Awaited<ReturnType<typeof reader.subtitles>> }[] =
            [];
        const settings = {
            getSingle: async (key: keyof typeof defaultSettings) => defaultSettings[key],
            profiles: async () => [],
            activeProfile: async () => undefined,
        } as unknown as SettingsProvider;
        const context = {
            video: document.createElement('video'),
            settings,
            hasPageScript: true,
            pause: () => {},
            keyBindings: { bind: () => {}, unbind: () => {} },
            subtitleController: { notification: () => {} },
            mobileVideoOverlayController: {},
            loadSubtitles: async (files: File[], flatten: boolean) => {
                const readable = await Promise.all(
                    files.map(
                        async (file) =>
                            ({
                                name: file.name,
                                text: async () => readBlob(file),
                            }) as File
                    )
                );
                loaded.push({ files, flatten, subtitles: await reader.subtitles(readable, flatten) });
            },
        } as unknown as Binding;
        const controller = new VideoDataSyncController(context, settings);
        controllers.push(controller);
        if (auto) {
            controller.updateSettings({
                ...defaultSettings,
                streamingAutoSync: true,
                streamingLastLanguagesSynced: { [window.location.host]: data.map((track) => track.language!) },
            });
            await controller.requestSubtitles({ kind: 'reload', videoChanged: true });
            document.dispatchEvent(new CustomEvent('asbplayer-synced-data', { detail: { subtitles: data } }));
        } else {
            await controller.show({ reason: VideoDataUiOpenReason.userRequested });
            mockConfirm({
                command: 'confirm',
                data,
                shouldRememberTrackChoices: false,
            });
        }
        for (let i = 0; i < 50 && loaded.length === 0; i++) await new Promise((resolve) => setTimeout(resolve, 10));
        expect(loaded).toHaveLength(1);
        return loaded[0];
    };

    const serve = (responses: Record<string, string>) => {
        global.fetch = jest.fn(
            async (url: string | URL | Request) =>
                ({
                    ok: true,
                    status: 200,
                    arrayBuffer: async () => Uint8Array.from(Buffer.from(responses[String(url)])).buffer,
                }) as Response
        );
    };

    it('keeps two segmented languages separate, deduplicates segment boundaries, and preserves timing and markup', async () => {
        serve({
            en1: cue('<i>Hello</i>'),
            en2: cue('<i>Hello</i>') + cue('Again', '00:00:03.000', '00:00:04.000').replace('WEBVTT\n\n', ''),
            es1: cue('Hola'),
            es2: cue('Otra vez', '00:00:03.000', '00:00:04.000'),
        });
        const result = await loadSelection([track('en', ['en1', 'en2']), track('es', ['es1', 'es2'])]);
        expect(result.files.map((file) => file.name)).toEqual(['en.srt', 'es.srt']);
        expect(result.flatten).toBe(false);
        expect(result.subtitles).toEqual([
            { start: 1000, end: 2000, text: '<i>Hello</i>', track: 0 },
            { start: 1000, end: 2000, text: 'Hola', track: 1 },
            { start: 3000, end: 4000, text: 'Again', track: 0 },
            { start: 3000, end: 4000, text: 'Otra vez', track: 1 },
        ]);
    });

    it('keeps a segmented language in track two when track one is empty', async () => {
        serve({ es1: cue('Hola') });
        const result = await loadSelection([track('-', '-'), track('es', ['es1'])]);
        expect(result.subtitles).toEqual([{ start: 1000, end: 2000, text: 'Hola', track: 1 }]);
    });

    it('preserves a regular file alongside a segmented language', async () => {
        serve({ en: cue('Hello'), es1: cue('Hola') });
        const result = await loadSelection([track('en', 'en'), track('es', ['es1'])]);
        expect(result.files.map((file) => file.name)).toEqual(['en.vtt', 'es.srt']);
        expect(result.subtitles.map(({ track, text }) => ({ track, text }))).toEqual([
            { track: 0, text: 'Hello' },
            { track: 1, text: 'Hola' },
        ]);
    });

    it('preserves separate languages when automatically loading remembered tracks', async () => {
        serve({ en1: cue('Hello'), es1: cue('Hola') });
        const result = await loadSelection([track('en', ['en1']), track('es', ['es1'])], true);
        expect(result.flatten).toBe(false);
        expect(result.subtitles.map(({ track, text }) => ({ track, text }))).toEqual([
            { track: 0, text: 'Hello' },
            { track: 1, text: 'Hola' },
        ]);
    });
});
