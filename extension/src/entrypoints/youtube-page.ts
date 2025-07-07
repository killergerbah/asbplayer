import { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { trackFromDef } from '@/pages/util';
import { decodePoToken, fetchPlayerContextForPage } from '@/services/youtube';

declare global {
    interface Window {
        ytcfg: any;
    }
}

const inferVideoId = () => {
    const pathname = window.location.pathname;

    if (pathname) {
        const pathVideoId = /\/(shorts|embed)\/(.*)/.exec(pathname)?.[2];

        if (pathVideoId) {
            return pathVideoId;
        }
    }

    const params = new URLSearchParams(window.location.search);
    return params.get('v') ?? undefined;
};

const ytTrackToSubtitleTrack = (track: any, url: URL) => {
    url.searchParams.set('fmt', 'srv3');
    const def = {
        label: track.name.text || track.name.simpleText || track.name?.runs?.[0]?.text || track.languageCode,
        language: track.languageCode,
        url: url.toString(),
        extension: 'ytsrv3',
    };
    return trackFromDef(def);
};

const androidInnerTubeTracks = async (videoId: string) => {
    if (typeof window.ytcfg?.get !== 'function') {
        return undefined;
    }

    const apiKey = window.ytcfg.get('INNERTUBE_API_KEY');

    if (!apiKey) {
        return undefined;
    }

    const response = await fetch(`https://${window.location.host}/youtubei/v1/player?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            context: {
                client: {
                    clientName: 'ANDROID',
                    clientVersion: '20.10.38',
                    hl: window.ytcfg.get('HL') || 'en',
                },
            },
            videoId,
        }),
    });

    if (response.status !== 200) {
        return undefined;
    }

    const payload = await response.json();
    const basename = payload.videoDetails?.title;

    if (typeof payload?.captions?.playerCaptionsTracklistRenderer?.captionTracks !== 'object') {
        return { basename };
    }

    const tracks = payload.captions.playerCaptionsTracklistRenderer.captionTracks;
    const subtitles: VideoDataSubtitleTrack[] = tracks.map((t: any) => {
        const url = new URL(t.baseUrl);
        return ytTrackToSubtitleTrack(t, url);
    });
    return { basename, subtitles };
};

const timedTextTracksUsingPot = async (videoId: string) => {
    const pot = decodePoToken(videoId);

    if (!pot) {
        return undefined;
    }

    const playerContext = await fetchPlayerContextForPage();
    const tracks = playerContext?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const subtitles = tracks.map((track: any) => {
        const baseUrl = track.baseUrl as string;
        const baseUrlWithHost = baseUrl.startsWith('/') ? `https://${window.location.host}${baseUrl}` : baseUrl;
        const url = new URL(baseUrlWithHost);
        url.searchParams.set('pot', pot.poToken);
        url.searchParams.set('c', 'WEB');
        return ytTrackToSubtitleTrack(track, url);
    });
    const basename = playerContext.videoDetails?.title;
    return { basename, subtitles };
};

const publishCurrentTracks = async () => {
    const response: VideoData = { error: '', basename: '', subtitles: [] };
    let videoId: string | undefined;

    try {
        videoId = inferVideoId();

        if (!videoId) {
            response.error = 'Could not determine video ID';
            return;
        }

        let basename: string = '';
        let subtitles: VideoDataSubtitleTrack[] | undefined;

        const androidInnerTubeInfo = await androidInnerTubeTracks(videoId);

        if (androidInnerTubeInfo) {
            basename = androidInnerTubeInfo.basename;
            subtitles = androidInnerTubeInfo.subtitles;
        }

        if (subtitles === undefined || !basename) {
            const timedTextUsingPotInfo = await timedTextTracksUsingPot(videoId);

            if (timedTextUsingPotInfo) {
                basename = basename || timedTextUsingPotInfo?.basename;
                subtitles = subtitles ?? timedTextUsingPotInfo?.subtitles;
            }
        }

        response.basename = basename || document.title;
        response.subtitles = subtitles ?? [];
        return videoId;
    } catch (error) {
        console.error(error);
        if (error instanceof Error) {
            response.error = error.message;
        } else {
            response.error = String(error);
        }
    } finally {
        // Do not publish subs if the video ID changed during track extraction - e.g. likely to happen on Shorts
        if (videoId === inferVideoId()) {
            document.dispatchEvent(
                new CustomEvent('asbplayer-synced-data', {
                    detail: response,
                })
            );
        }
    }
};

export default defineUnlistedScript(() => {
    let lastVideoIdDispatched: string | undefined;

    document.addEventListener(
        'asbplayer-get-synced-data',
        async (e) => {
            lastVideoIdDispatched = await publishCurrentTracks();
        },
        false
    );

    let publishing = false;

    // Handle YT shorts: Publish subtitle tracks according to current video ID
    setInterval(async () => {
        if (publishing) {
            return;
        }

        try {
            publishing = true;
            const videoId = inferVideoId();
            if (lastVideoIdDispatched && videoId && lastVideoIdDispatched !== videoId) {
                lastVideoIdDispatched = await publishCurrentTracks();
            }
        } finally {
            publishing = false;
        }
    }, 500);
});
