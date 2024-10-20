import {
    ConfirmedVideoDataSubtitleTrack,
    ExtensionSyncMessage,
    SerializedSubtitleFile,
    VideoData,
    VideoDataSubtitleTrack,
    VideoDataUiBridgeConfirmMessage,
    VideoDataUiBridgeOpenFileMessage,
    VideoDataUiModel,
    VideoDataUiOpenReason,
    VideoToExtensionCommand,
} from '@project/common';
import { AsbplayerSettings, SettingsProvider, SubtitleListPreference } from '@project/common/settings';
import { bufferToBase64 } from '@project/common/base64';
import Binding from '../services/binding';
import { currentPageDelegate } from '../services/pages';
import { Parser as m3U8Parser } from 'm3u8-parser';
import UiFrame from '../services/ui-frame';
import { fetchLocalization } from '../services/localization-fetcher';
import i18n from 'i18next';

async function html(lang: string) {
    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>asbplayer - Video Data Sync</title>
                <style>
                    @import url(${chrome.runtime.getURL('./assets/fonts.css')});
                </style>
            </head>
            <body>
                <div id="root" style="width:100%;height:100vh;"></div>
                <script type="application/json" id="loc">${JSON.stringify(await fetchLocalization(lang))}</script>
                <script src="${chrome.runtime.getURL('./video-data-sync-ui.js')}"></script>
            </body>
            </html>`;
}

interface ShowOptions {
    reason: VideoDataUiOpenReason;
    fromAsbplayerId?: string;
}

const fetchDataForLanguageOnDemand = (language: string): Promise<VideoData> => {
    return new Promise((resolve, reject) => {
        const listener = (event: Event) => {
            const data = (event as CustomEvent).detail as VideoData;
            resolve(data);
            document.removeEventListener('asbplayer-synced-language-data', listener, false);
        };
        document.addEventListener('asbplayer-synced-language-data', listener, false);
        document.dispatchEvent(new CustomEvent('asbplayer-get-synced-language-data', { detail: language }));
    });
};

export default class VideoDataSyncController {
    private readonly _context: Binding;
    private readonly _domain: string;
    private readonly _frame: UiFrame;
    private readonly _settings: SettingsProvider;

    private _autoSync?: boolean;
    private _lastLanguagesSynced: { [key: string]: string[] };
    private _emptySubtitle: VideoDataSubtitleTrack;
    private _syncedData?: VideoData;
    private _wasPaused?: boolean;
    private _fullscreenElement?: Element;
    private _activeElement?: Element;
    private _autoSyncAttempted: boolean = false;
    private _dataReceivedListener?: (event: Event) => void;

    constructor(context: Binding, settings: SettingsProvider) {
        this._context = context;
        this._settings = settings;
        this._autoSync = false;
        this._lastLanguagesSynced = {};
        this._emptySubtitle = {
            id: '-',
            language: '-',
            url: '-',
            label: i18n.t('extension.videoDataSync.emptySubtitleTrack'),
            extension: 'srt',
        };
        this._domain = new URL(window.location.href).host;
        this._frame = new UiFrame(html);
    }

    private get lastLanguageSynced(): string[] {
        return this._lastLanguagesSynced[this._domain] ?? [];
    }

    private set lastLanguageSynced(value: string[]) {
        this._lastLanguagesSynced[this._domain] = value;
    }

    unbind() {
        if (this._dataReceivedListener) {
            document.removeEventListener('asbplayer-synced-data', this._dataReceivedListener, false);
        }

        this._dataReceivedListener = undefined;
        this._syncedData = undefined;
    }

    updateSettings({ streamingAutoSync, streamingLastLanguagesSynced }: AsbplayerSettings) {
        this._autoSync = streamingAutoSync;
        this._lastLanguagesSynced = streamingLastLanguagesSynced;
    }

    requestSubtitles() {
        if (!this._context.hasPageScript || !currentPageDelegate()?.isVideoPage()) {
            return;
        }

        this._syncedData = undefined;
        this._autoSyncAttempted = false;

        if (!this._dataReceivedListener) {
            this._dataReceivedListener = (event: Event) => {
                const data = (event as CustomEvent).detail as VideoData;
                this._setSyncedData(data);
            };
            document.addEventListener('asbplayer-synced-data', this._dataReceivedListener, false);
        }

        document.dispatchEvent(new CustomEvent('asbplayer-get-synced-data'));
    }

    async show({ reason, fromAsbplayerId }: ShowOptions) {
        const client = await this._client();
        const additionalFields: Partial<VideoDataUiModel> = {
            open: true,
            openReason: reason,
        };

        if (fromAsbplayerId !== undefined) {
            additionalFields.openedFromAsbplayerId = fromAsbplayerId;
        }

        const model = await this._buildModel(additionalFields);
        this._prepareShow();
        client.updateState(model);
    }

    private async _buildModel(additionalFields: Partial<VideoDataUiModel>) {
        const subtitleTrackChoices = this._syncedData?.subtitles ?? [];
        const subs = this._matchLastSyncedWithAvailableTracks();
        const autoSelectedTracks: VideoDataSubtitleTrack[] = subs.autoSelectedTracks;
        const autoSelectedTrackIds = autoSelectedTracks.map((subtitle) => subtitle.id || '-');
        const defaultCheckboxState: boolean = subs.completeMatch;
        const themeType = await this._context.settings.getSingle('themeType');

        return this._syncedData
            ? {
                  isLoading: this._syncedData.subtitles === undefined,
                  suggestedName: this._syncedData.basename,
                  selectedSubtitle: autoSelectedTrackIds,
                  subtitles: subtitleTrackChoices,
                  error: this._syncedData.error,
                  themeType: themeType,
                  defaultCheckboxState: defaultCheckboxState,
                  openedFromAsbplayerId: '',
                  ...additionalFields,
              }
            : {
                  isLoading: this._context.hasPageScript,
                  suggestedName: document.title,
                  selectedSubtitle: autoSelectedTrackIds,
                  error: '',
                  showSubSelect: true,
                  subtitles: subtitleTrackChoices,
                  themeType: themeType,
                  defaultCheckboxState: defaultCheckboxState,
                  openedFromAsbplayerId: '',
                  ...additionalFields,
              };
    }

    private _matchLastSyncedWithAvailableTracks() {
        const subtitleTrackChoices = this._syncedData?.subtitles ?? [];
        let tracks = {
            autoSelectedTracks: [this._emptySubtitle, this._emptySubtitle, this._emptySubtitle],
            completeMatch: false,
        };

        const emptyChoice = this.lastLanguageSynced.some((lang) => lang !== '-') === undefined;

        if (!subtitleTrackChoices.length && emptyChoice) {
            tracks.completeMatch = true;
        } else {
            let matches: number = 0;
            for (let i = 0; i < this.lastLanguageSynced.length; i++) {
                const language = this.lastLanguageSynced[i];
                for (let j = 0; j < subtitleTrackChoices.length; j++) {
                    if (language === '-') {
                        matches++;
                        break;
                    } else if (language === subtitleTrackChoices[j].language) {
                        tracks.autoSelectedTracks[i] = subtitleTrackChoices[j];
                        matches++;
                        break;
                    }
                }
            }
            if (matches === this.lastLanguageSynced.length) {
                tracks.completeMatch = true;
            }
        }

        return tracks;
    }

    private _defaultVideoName(basename: string | undefined, subtitleTrack: VideoDataSubtitleTrack) {
        if (subtitleTrack.url === '-') {
            return basename ?? '';
        }

        if (basename) {
            return `${basename} - ${subtitleTrack.label}`;
        }

        return subtitleTrack.label;
    }

    private async _setSyncedData(data: VideoData) {
        this._syncedData = data;

        if (this._syncedData?.subtitles !== undefined && this._canAutoSync()) {
            if (!this._autoSyncAttempted) {
                this._autoSyncAttempted = true;
                const subs = this._matchLastSyncedWithAvailableTracks();

                if (subs.completeMatch) {
                    const autoSelectedTracks: VideoDataSubtitleTrack[] = subs.autoSelectedTracks;
                    await this._syncData(autoSelectedTracks);

                    if (!this._frame.hidden) {
                        this._hideAndResume();
                    }
                } else {
                    await this.show({ reason: VideoDataUiOpenReason.failedToAutoLoadPreferredTrack });
                }
            }
        } else if (this._frame.clientIfLoaded !== undefined) {
            this._frame.clientIfLoaded.updateState(await this._buildModel({}));
        }
    }

    private _canAutoSync(): boolean {
        const page = currentPageDelegate();

        if (page === undefined) {
            return this._autoSync ?? false;
        }

        return this._autoSync === true && page.canAutoSync(this._context.video);
    }

    private async _client() {
        this._frame.language = await this._settings.getSingle('language');
        const isNewClient = await this._frame.bind();
        const client = await this._frame.client();

        if (isNewClient) {
            client.onMessage(async (message) => {
                let dataWasSynced = true;

                if ('confirm' === message.command) {
                    const confirmMessage = message as VideoDataUiBridgeConfirmMessage;

                    if (confirmMessage.shouldRememberTrackChoices) {
                        this.lastLanguageSynced = confirmMessage.data.map((track) => track.language);
                        await this._context.settings
                            .set({ streamingLastLanguagesSynced: this._lastLanguagesSynced })
                            .catch(() => {});
                    }

                    const data = confirmMessage.data as ConfirmedVideoDataSubtitleTrack[];

                    dataWasSynced = await this._syncDataArray(data, confirmMessage.syncWithAsbplayerId);
                } else if ('openFile' === message.command) {
                    const openFileMessage = message as VideoDataUiBridgeOpenFileMessage;
                    const subtitles = openFileMessage.subtitles as SerializedSubtitleFile[];

                    try {
                        await this._syncSubtitles(subtitles, false);
                        dataWasSynced = true;
                    } catch (e) {
                        if (e instanceof Error) {
                            await this._reportError(e.message);
                        }
                    }
                }

                if (dataWasSynced) {
                    this._hideAndResume();
                }
            });
        }

        this._frame.show();
        return client;
    }

    private _prepareShow() {
        this._wasPaused = this._wasPaused ?? this._context.video.paused;
        this._context.pause();

        if (document.fullscreenElement) {
            this._fullscreenElement = document.fullscreenElement;
            document.exitFullscreen();
        }

        if (document.activeElement) {
            this._activeElement = document.activeElement;
        }

        this._context.keyBindings.unbind();
        this._context.subtitleController.forceHideSubtitles = true;
        this._context.mobileVideoOverlayController.forceHide = true;
    }

    private _hideAndResume() {
        this._context.keyBindings.bind(this._context);
        this._context.subtitleController.forceHideSubtitles = false;
        this._context.mobileVideoOverlayController.forceHide = false;
        this._frame?.hide();

        if (this._fullscreenElement) {
            this._fullscreenElement.requestFullscreen();
            this._fullscreenElement = undefined;
        }

        if (this._activeElement) {
            if (typeof (this._activeElement as HTMLElement).focus === 'function') {
                (this._activeElement as HTMLElement).focus();
            }

            this._activeElement = undefined;
        } else {
            window.focus();
        }

        if (!this._wasPaused) {
            this._context.play();
        }

        this._wasPaused = undefined;
    }

    private async _syncData(data: VideoDataSubtitleTrack[]) {
        try {
            let subtitles: SerializedSubtitleFile[] = [];

            for (let i = 0; i < data.length; i++) {
                const { extension, url, m3U8BaseUrl, language } = data[i];
                const subtitleFiles = await this._subtitlesForUrl(
                    this._defaultVideoName(this._syncedData?.basename, data[i]),
                    language,
                    extension,
                    url,
                    m3U8BaseUrl
                );
                if (subtitleFiles !== undefined) {
                    subtitles.push(...subtitleFiles);
                }
            }

            await this._syncSubtitles(
                subtitles,
                data.some((track) => track.m3U8BaseUrl !== undefined)
            );
            return true;
        } catch (error) {
            if (typeof (error as Error).message !== 'undefined') {
                await this._reportError(`Data Sync failed: ${(error as Error).message}`);
            }

            return false;
        }
    }

    private async _syncDataArray(data: ConfirmedVideoDataSubtitleTrack[], syncWithAsbplayerId?: string) {
        try {
            let subtitles: SerializedSubtitleFile[] = [];

            for (let i = 0; i < data.length; i++) {
                const { name, language, extension, url, m3U8BaseUrl } = data[i];
                const subtitleFiles = await this._subtitlesForUrl(name, language, extension, url, m3U8BaseUrl);
                if (subtitleFiles !== undefined) {
                    subtitles.push(...subtitleFiles);
                }
            }

            await this._syncSubtitles(
                subtitles,
                data.some((track) => track.m3U8BaseUrl !== undefined),
                syncWithAsbplayerId
            );
            return true;
        } catch (error) {
            if (typeof (error as Error).message !== 'undefined') {
                await this._reportError(`Data Sync failed: ${(error as Error).message}`);
            }

            return false;
        }
    }

    private async _syncSubtitles(
        serializedFiles: SerializedSubtitleFile[],
        flatten: boolean,
        syncWithAsbplayerId?: string
    ) {
        const files: File[] = await Promise.all(
            serializedFiles.map(
                async (f) => new File([await (await fetch('data:text/plain;base64,' + f.base64)).blob()], f.name)
            )
        );
        this._context.loadSubtitles(files, flatten, syncWithAsbplayerId);
    }

    private async _subtitlesForUrl(
        name: string,
        language: string,
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

        if (url === 'lazy') {
            const data = await fetchDataForLanguageOnDemand(language);

            if (data.error) {
                await this._reportError(data.error);
                return undefined;
            }

            const lazilyFetchedUrl = data.subtitles?.find((t) => t.language === language)?.url;

            if (lazilyFetchedUrl === undefined) {
                await this._reportError('Failed to fetch subtitles for specified language');
                return undefined;
            }

            url = lazilyFetchedUrl;
        }

        const response = await fetch(url).catch((error) => this._reportError(error.message));

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

    private async _reportError(error: string) {
        const client = await this._client();
        const themeType = await this._context.settings.getSingle('themeType');

        this._prepareShow();

        return client.updateState({
            open: true,
            isLoading: false,
            showSubSelect: true,
            error,
            themeType: themeType,
        });
    }
}
