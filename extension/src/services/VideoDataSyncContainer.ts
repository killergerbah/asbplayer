import {
    ConfirmedVideoDataSubtitleTrack,
    ExtensionSettings,
    ExtensionSyncMessage,
    SerializedSubtitleFile,
    VideoData,
    VideoDataSubtitleTrack,
    VideoDataUiState,
    VideoToExtensionCommand,
} from '@project/common';
import { bufferToBase64 } from '../services/Base64';
import FrameBridgeClient from '../services/FrameBridgeClient';
import Binding from './Binding';
import ImageElement from './ImageElement';
import { currentPageDelegate } from './pages';
import { Parser as m3U8Parser } from 'm3u8-parser';

function html() {
    return `<!DOCTYPE html>
              <html lang="en">
              <head>
                  <meta charset="utf-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1" />
                  <title>asbplayer - Video Data Sync</title>
              </head>
              <body>
              <div id="root" style="width:100%;height:100vh;"></div>
              <script src="${chrome.runtime.getURL('./video-data-sync-ui.js')}"></script>
              </body>
              </html>`;
}

export default class VideoDataSyncContainer {
    private readonly context: Binding;
    private readonly domain: string;

    private videoSelectBound?: boolean;
    private imageElement: ImageElement;
    private doneListener?: () => void;
    private autoSync?: boolean;
    private lastLanguagesSynced: { [key: string]: string };
    private boundFunction?: (event: Event) => void;
    private requested: boolean;
    private client?: FrameBridgeClient;
    private frame?: HTMLIFrameElement;
    private syncedData?: VideoData;
    private wasPaused?: boolean;
    private fullscreenElement?: Element;
    private activeElement?: Element;
    private autoSyncing: boolean = false;

    constructor(context: Binding) {
        this.context = context;
        this.videoSelectBound = false;
        this.imageElement = new ImageElement(context.video);
        this.doneListener;
        this.autoSync = false;
        this.lastLanguagesSynced = {};
        this.boundFunction;
        this.requested = false;
        this.domain = new URL(window.location.href).host;
    }

    private get lastLanguageSynced() {
        return this.lastLanguagesSynced[this.domain] ?? '';
    }

    private set lastLanguageSynced(value: string) {
        this.lastLanguagesSynced[this.domain] = value;
    }

    bindVideoSelect(doneListener: () => void) {
        if (this.videoSelectBound) {
            throw new Error('Video select container already bound');
        }

        const image = this.imageElement.element();
        image.classList.remove('asbplayer-hide');
        image.classList.add('asbplayer-mouse-over-image');

        image.addEventListener('click', (e) => {
            e.preventDefault();
            this.doneListener = doneListener;
            this.show();
        });

        this.videoSelectBound = true;
    }

    unbind() {
        if (this.boundFunction) {
            document.removeEventListener('asbplayer-synced-data', this.boundFunction, false);
        }

        this.boundFunction = undefined;
        this.syncedData = undefined;
        this.unbindVideoSelect();
    }

    unbindVideoSelect() {
        this.imageElement.remove();

        if (this.client) {
            this.client.unbind();
            this.client = undefined;
        }

        if (this.frame) {
            this.frame.remove();
            this.frame = undefined;
        }

        this.requested = false;
        this.wasPaused = undefined;
        this.videoSelectBound = false;
        this.doneListener = undefined;
    }

    updateSettings({ autoSync, lastLanguagesSynced }: ExtensionSettings) {
        this.autoSync = autoSync;
        this.lastLanguagesSynced = lastLanguagesSynced;
    }

    requestSubtitles() {
        if (!this.context.subSyncAvailable || this._blockRequest()) {
            return;
        }

        this.syncedData = undefined;

        if (!this.boundFunction) {
            this.boundFunction = (event: Event) => {
                this._setSyncedData(event as CustomEvent);
            };
            document.addEventListener('asbplayer-synced-data', this.boundFunction, false);
        }

        document.dispatchEvent(new CustomEvent('asbplayer-get-synced-data'));
    }

    async show(userRequested = true) {
        if (this._blockRequest()) {
            if (this.doneListener) this.doneListener();
            return;
        }

        const themeType = (await this.context.settings.get(['lastThemeType'])).lastThemeType;
        let state: VideoDataUiState = this.syncedData
            ? {
                  open: true,
                  isLoading: false,
                  suggestedName: this.syncedData.basename,
                  subtitles: [
                      { language: '', url: '-', label: 'None', extension: 'srt' },
                      ...this.syncedData.subtitles,
                  ],
                  error: this.syncedData.error,
                  themeType: themeType,
              }
            : {
                  open: true,
                  isLoading: this.context.subSyncAvailable,
                  showSubSelect: true,
                  subtitles: [{ language: '', url: '-', label: 'None', extension: 'srt' }],
                  themeType: themeType,
              };

        this.requested = userRequested;

        const selectedSub = state.subtitles!.find((subtitle) => subtitle.language === this.lastLanguageSynced);

        if (selectedSub && !userRequested && !state.error && !this.autoSyncing) {
            this.autoSyncing = true;
            try {
                if (
                    (await this._syncData(
                        this._defaultVideoName(this.syncedData?.basename, selectedSub),
                        selectedSub.extension,
                        selectedSub.url,
                        selectedSub.m3U8BaseUrl
                    )) &&
                    this.doneListener
                ) {
                    this.doneListener();
                }
            } finally {
                this.autoSyncing = false;
            }
            return;
        }

        state.selectedSubtitle = selectedSub?.url || '-';

        const client = await this._client();

        this._prepareShow();
        client.updateState(state);
    }

    _defaultVideoName(basename: string | undefined, subtitleTrack: VideoDataSubtitleTrack) {
        if (subtitleTrack.url === '-') {
            return basename ?? '';
        }

        if (basename) {
            return `${basename} - ${subtitleTrack.label}`;
        }

        return subtitleTrack.label;
    }

    _blockRequest() {
        let shallBlock = false;
        const page = currentPageDelegate();

        if (page === undefined) {
            return shallBlock;
        }

        shallBlock = !page.isVideoPage();
        return shallBlock;
    }

    _setSyncedData({ detail: data }: CustomEvent) {
        this.syncedData = data;

        if (this.requested || this._canAutoSync()) {
            this.show(this.requested);
        }
    }

    private _canAutoSync(): boolean {
        const page = currentPageDelegate();

        if (page === undefined) {
            return this.autoSync ?? false;
        }

        return this.autoSync === true && page.canAutoSync(this.context.video);
    }

    async _client() {
        if (this.client) {
            await this.client.bind();
            this.frame?.classList?.remove('asbplayer-hide');
            return this.client;
        }

        this.frame = document.createElement('iframe');
        this.frame.className = 'asbplayer-ui-frame';
        this.client = new FrameBridgeClient(this.frame, this.context.video.src);
        document.body.appendChild(this.frame);
        const doc = this.frame.contentDocument!;
        doc.open();
        doc.write(await html());
        doc.close();
        await this.client.bind();
        this.client.onFinished(async (message) => {
            let shallUpdate = true;

            if ('confirm' === message.command) {
                if (this.lastLanguageSynced !== message.data.language && this.syncedData) {
                    this.lastLanguageSynced = message.data.language;
                    await this.context.settings.set({ lastLanguagesSynced: this.lastLanguagesSynced }).catch(() => {});
                }

                const data = message.data as ConfirmedVideoDataSubtitleTrack;

                shallUpdate = await this._syncData(data.name, data.extension, data.subtitleUrl, data.m3U8BaseUrl);
            }

            if (shallUpdate) {
                this.context.keyBindings.bind(this.context);
                this.context.subtitleContainer.forceHideSubtitles = false;
                this.frame?.classList?.add('asbplayer-hide');

                if (this.fullscreenElement) {
                    this.fullscreenElement.requestFullscreen();
                    this.fullscreenElement = undefined;
                }

                if (this.activeElement) {
                    if (typeof (this.activeElement as HTMLElement).focus === 'function') {
                        (this.activeElement as HTMLElement).focus();
                    }

                    this.activeElement = undefined;
                } else {
                    window.focus();
                }

                if (!this.wasPaused) {
                    this.context.play();
                }

                this.wasPaused = undefined;
                if (this.doneListener) this.doneListener();
            }

            this.requested = false;
        });

        return this.client;
    }

    _prepareShow() {
        this.wasPaused = this.wasPaused ?? this.context.video.paused;
        this.context.pause();

        if (document.fullscreenElement) {
            this.fullscreenElement = document.fullscreenElement;
            document.exitFullscreen();
        }

        if (document.activeElement) {
            this.activeElement = document.activeElement;
        }

        this.context.keyBindings.unbind();
        this.context.subtitleContainer.forceHideSubtitles = true;
    }

    async _syncData(name: string, extension: string, subtitleUrl: string, m3U8BaseUrl: string | undefined) {
        try {
            let subtitles: SerializedSubtitleFile[] | undefined;
            subtitles = await this._subtitlesForUrl(name, extension, subtitleUrl, m3U8BaseUrl);

            if (subtitles === undefined) {
                return false;
            }

            const command: VideoToExtensionCommand<ExtensionSyncMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'sync',
                    subtitles: subtitles,
                    flatten: m3U8BaseUrl !== undefined,
                },
                src: this.context.video.src,
            };
            chrome.runtime.sendMessage(command);
            return true;
        } catch (error) {
            if (typeof (error as Error).message !== 'undefined') {
                this._reportError(name, `Data Sync failed: ${(error as Error).message}`);
            }

            return false;
        }
    }

    private async _subtitlesForUrl(
        name: string,
        extension: string,
        url: string,
        m3U8BaseUrl?: string
    ): Promise<SerializedSubtitleFile[] | undefined> {
        if (url === '-') {
            return [
                {
                    name: `${name}.${extension}`,
                    base64: '',
                },
            ];
        }

        const response = await fetch(url).catch((error) => {
            this._reportError(name, error.message);
        });

        if (!response) {
            return undefined;
        }

        if (extension === 'm3u8') {
            const m3U8Response = await fetch(url);
            const parser = new m3U8Parser();
            parser.push(await m3U8Response.text());
            parser.end();

            if (!parser.manifest.segments || parser.manifest.segments.length === 0) {
                return undefined;
            }

            const firstUri = parser.manifest.segments[0].uri;
            const partExtension = firstUri.substring(firstUri.lastIndexOf('.') + 1);
            const promises = parser.manifest.segments
                .filter((s: any) => !s.discontinuity && s.uri)
                .map((s: any) => fetch(`${m3U8BaseUrl}/${s.uri}`));
            const tracks = [];

            for (const p of promises) {
                const response = await p;

                if (!response.ok) {
                    throw new Error(
                        `Subtitle Retrieval failed with Status ${response.status}/${response.statusText}...`
                    );
                }

                tracks.push({
                    name: `${name}.${partExtension}`,
                    base64: bufferToBase64(await response.arrayBuffer()),
                });
            }

            return tracks;
        }

        if (!response.ok) {
            throw new Error(`Subtitle Retrieval failed with Status ${response.status}/${response.statusText}...`);
        }

        return [
            {
                name: `${name}.${extension}`,
                base64: response ? bufferToBase64(await response.arrayBuffer()) : '',
            },
        ];
    }

    async _reportError(suggestedName: string, error: string) {
        const client = await this._client();
        const themeType = (await this.context.settings.get(['lastThemeType'])).lastThemeType;

        this._prepareShow();

        return client.updateState({
            open: true,
            isLoading: false,
            suggestedName,
            showSubSelect: this.context.subSyncAvailable,
            subtitles: [{ language: '', url: '-', label: 'None' }, ...(this.syncedData?.subtitles || [])],
            selectedSubtitle:
                this.syncedData?.subtitles.find((subtitle) => subtitle.language === this.lastLanguageSynced)?.url ||
                '-',
            error,
            themeType: themeType,
        });
    }
}
