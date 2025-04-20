import { VideoData, VideoDataSubtitleTrack, VideoDataSubtitleTrackDef } from '@project/common';
import { extractExtension, poll, trackId } from '@/pages/util';

declare global {
    interface XMLHttpRequest {
        _vodPlaybackResourcesTitleId?: string;
    }
}
interface MetadataUrls {
    vodPlaybackResourcesUrl?: string;
    vodPlaybackResourceBody?: string;
    playerChromeResourcesUrl?: string;
}

export default defineUnlistedScript(() => {
    const metadataUrls: { [entityId: string]: MetadataUrls } = {};

    const urlParam = (url: string, param: string) => {
        const params = new URLSearchParams(new URL(url).search);
        return params.get(param);
    };

    let lastEntityId: string | undefined;

    const originalXhrOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function () {
        const url = arguments[1];

        if (typeof url === 'string') {
            if (url.includes('GetVodPlaybackResources')) {
                const titleId = urlParam(url, 'titleId');

                if (titleId) {
                    const urls = metadataUrls[titleId] ?? {};
                    urls.vodPlaybackResourcesUrl = url;
                    metadataUrls[titleId] = urls;
                    lastEntityId = titleId;
                    this._vodPlaybackResourcesTitleId = titleId;
                }
            }

            if (url.includes('playerChromeResources') && url.includes('catalogMetadataV2')) {
                const entityId = urlParam(url, 'entityId');

                if (entityId) {
                    const urls = metadataUrls[entityId] ?? {};
                    urls.playerChromeResourcesUrl = url;
                    metadataUrls[entityId] = urls;
                    lastEntityId = entityId;
                }
            }
        }

        // @ts-ignore
        originalXhrOpen.apply(this, arguments);
    };

    const originalXhrSend = window.XMLHttpRequest.prototype.send;
    window.XMLHttpRequest.prototype.send = function () {
        if (this._vodPlaybackResourcesTitleId && typeof arguments[0] === 'string') {
            metadataUrls[this._vodPlaybackResourcesTitleId].vodPlaybackResourceBody = arguments[0];
        }

        // @ts-ignore
        originalXhrSend.apply(this, arguments);
    };

    const basenameFromUrl = async (url: string) => {
        const catalog = (await (await fetch(url)).json())?.resources?.catalogMetadataV2?.catalog;

        if (!catalog) {
            return '';
        }

        const parts = [];

        if (typeof catalog.seriesTitle === 'string') {
            const seriesParts = [];
            seriesParts.push(catalog.seriesTitle);

            if (typeof catalog.seasonNumber === 'number') {
                seriesParts.push(`S${catalog.seasonNumber}`);
            }

            if (typeof catalog.episodeNumber === 'number') {
                seriesParts.push(`E${catalog.episodeNumber}`);
            }

            parts.push(seriesParts.join('.'));
        }

        if (typeof catalog.title === 'string') {
            parts.push(catalog.title);
        }

        return parts.join(' - ');
    };

    const tracksFromUrl = async (url: string, body: string) => {
        const response = await (await fetch(url, { method: 'POST', body, credentials: 'include' })).json();
        const tracks = response?.timedTextUrls?.result?.subtitleUrls;
        const subtitleTracks: VideoDataSubtitleTrack[] = [];

        if (tracks instanceof Array) {
            for (const track of tracks) {
                const def: VideoDataSubtitleTrackDef = {
                    label: track.displayName,
                    language: track.languageCode.toLowerCase(),
                    url: track.url,
                    extension: extractExtension(track.url, 'ttml2'),
                };

                subtitleTracks.push({
                    id: trackId(def),
                    ...def,
                });
            }
        }

        return subtitleTracks;
    };

    document.addEventListener(
        'asbplayer-get-synced-data',
        async () => {
            try {
                if (lastEntityId) {
                    const entityId = lastEntityId;
                    const capturedUrls = await poll(() => {
                        const urls = metadataUrls[entityId];
                        return Boolean(
                            urls &&
                                urls.playerChromeResourcesUrl &&
                                urls.vodPlaybackResourcesUrl &&
                                urls.vodPlaybackResourceBody
                        );
                    });

                    if (capturedUrls) {
                        const urls = metadataUrls[entityId];
                        const basename = await basenameFromUrl(urls.playerChromeResourcesUrl!);
                        const subtitles = await tracksFromUrl(
                            urls.vodPlaybackResourcesUrl!,
                            urls.vodPlaybackResourceBody!
                        );
                        const data: VideoData = { basename, subtitles };
                        document.dispatchEvent(
                            new CustomEvent('asbplayer-synced-data', {
                                detail: data,
                            })
                        );
                    } else {
                        document.dispatchEvent(
                            new CustomEvent('asbplayer-synced-data', {
                                detail: { error: 'Could not capture metadata', basename: '', subtitles: [] },
                            })
                        );
                    }
                } else {
                    document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', {
                            detail: { error: 'Could not capture video ID', basename: '', subtitles: [] },
                        })
                    );
                }
            } catch (e) {
                const error = e instanceof Error ? e.message : String(e);
                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: { error },
                    })
                );
            }
        },
        false
    );
});
