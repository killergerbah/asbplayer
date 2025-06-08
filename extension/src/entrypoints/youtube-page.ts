import { VideoData } from '@project/common';
import { trackId } from '@/pages/util';
import { Innertube } from 'youtubei.js';
import type { YT } from 'youtubei.js';
import SrtParser from '@qgustavor/srt-parser';
import { bufferToBase64 } from '@project/common/base64';

const stringToArrayBuffer = (str: string) => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return bytes.buffer;
};

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

const defaultTranscript = async () => {
    const videoId = inferVideoId();

    if (!videoId) {
        throw new Error('Unable to infer video ID');
    }

    return defaultTranscriptForVideoId(videoId);
};

const defaultTranscriptForVideoId = async (videoId: string) => {
    const mobileYoutube = location.host === 'm.youtube.com';
    const innertube = await Innertube.create({
        retrieve_player: false,
        // Ensure fetch's `this` does not change
        fetch: (...args) => {
            if (!mobileYoutube) {
                return window.fetch(...args);
            }

            // Hack: Replace URL to support mobile website m.youtube.com
            const arg = args[0];
            const toMobileUrl = (url: string) => {
                return url.replace('www.youtube.com', 'm.youtube.com');
            };

            if (arg instanceof URL) {
                args[0] = new URL(toMobileUrl(arg.toString()));
            } else if (arg instanceof Request) {
                const req = arg as Request;
                const reqInit: RequestInit = {
                    method: req.method,
                    keepalive: req.keepalive,
                    headers: req.headers,
                    body: req.body,
                    redirect: req.redirect,
                    integrity: req.integrity,
                    signal: req.signal,
                    credentials: req.credentials,
                    mode: req.mode,
                    referrer: req.referrer,
                    referrerPolicy: req.referrerPolicy,
                    // https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests
                    // @ts-ignore
                    duplex: req.body instanceof ReadableStream ? 'half' : undefined,
                };
                const newReq = new Request(toMobileUrl(req.url), reqInit);
                args[0] = newReq;
            }

            return window.fetch(...args);
        },
        retrieve_innertube_config: false,
    });
    const info = await innertube.getInfo(videoId);
    try {
        const transcript = await info.getTranscript();
        return { info, transcript };
    } catch (e) {
        if (e instanceof Error && e.message.includes('Transcript panel not found.')) {
            return { info };
        }

        throw e;
    }
};

const lazyTracksForTranscript = (transcript: YT.TranscriptInfo) => {
    return transcript.languages.map((lang) => {
        const def = {
            label: lang,
            language: lang,
            // As of this writing there is no known reliable way to obtain static URLs to fetch YT subtitles.
            // So we indicate with the 'lazy' sentinel value that the subtitles should be fetched lazily using InnerTube's API.
            url: 'lazy',
            extension: 'srt',
        };
        return {
            id: trackId(def),
            ...def,
        };
    });
};

const publishCurrentLazyTracks = async () => {
    const response: VideoData = { error: '', basename: '', subtitles: [] };
    let videoId: string | undefined;

    try {
        videoId = inferVideoId();
        const { info, transcript } = await defaultTranscript();
        response.basename = info.basic_info.title ?? document.title;
        response.subtitles = transcript === undefined ? [] : lazyTracksForTranscript(transcript);
        return info.basic_info.id;
    } catch (error) {
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
            lastVideoIdDispatched = await publishCurrentLazyTracks();
        },
        false
    );

    document.addEventListener(
        'asbplayer-get-synced-language-data',
        // Resolve lazily fetched subtitles for specific language
        async (e) => {
            const response: VideoData = { error: '', basename: '', subtitles: [] };

            try {
                const { info, transcript } = await defaultTranscript();
                const event = e as CustomEvent;
                const language = event.detail as string;

                if (!transcript) {
                    return;
                }

                const transcriptForLanguage = await transcript.selectLanguage(language);
                const nodes =
                    transcriptForLanguage.transcript.content?.body?.initial_segments?.map((seg, i) => {
                        return {
                            id: String(i),
                            startTime: Number(seg.start_ms),
                            endTime: Number(seg.end_ms),
                            text: seg.snippet.text ?? '',
                        };
                    }) ?? [];
                const parser = new SrtParser({ numericTimestamps: true });
                const serializedSrt = bufferToBase64(stringToArrayBuffer(parser.toSrt(nodes)));
                const trackDef = {
                    label: transcriptForLanguage.selectedLanguage,
                    language: transcriptForLanguage.selectedLanguage,
                    // Current data structure only supports URLs for effectively transferring a string pointer to the subtitle data.
                    // Hack: use data URL to transfer a base64-encoded SRT of the transcript.
                    url: `data:text/plain;base64,${serializedSrt}`,
                    extension: 'srt',
                };
                response.basename = info.basic_info.title ?? document.title;
                response.subtitles = [
                    {
                        id: trackId(trackDef),
                        ...trackDef,
                    },
                ];
            } catch (e) {
                response.error = e instanceof Error ? e.message : String(e);
            } finally {
                document.dispatchEvent(new CustomEvent('asbplayer-synced-language-data', { detail: response }));
            }
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
                lastVideoIdDispatched = await publishCurrentLazyTracks();
            }
        } finally {
            publishing = false;
        }
    }, 500);
});
