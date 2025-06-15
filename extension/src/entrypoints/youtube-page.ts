import { VideoData } from '@project/common';
import { trackId } from '@/pages/util';
import { Innertube } from 'youtubei.js';
import type { YT } from 'youtubei.js';
import SrtParser from '@qgustavor/srt-parser';
import { bufferToBase64, base64ToBuffer } from '@project/common/base64';

const computeHash = (input: string, start: int = 0, end: int = input.length) => {
  let hash = 0;
  for (let i = start; i < end; i++) {
    const code = typeof input === "string" ? input.charCodeAt(i) : input[i];
    hash = Math.imul(31, hash) + code | 0;
  }
  return hash;
}

const generateKeyPair = (keyMaterial: string) => {
  const mid = keyMaterial.length >> 1;
  return [
    computeHash(keyMaterial, 0, mid),
    computeHash(keyMaterial, mid)
  ];
}

const transformData = (data: Uint8Array, keyMaterial: int[]) => {
  const [key1, key2] = generateKeyPair(keyMaterial);
  const data32 = new Uint32Array(data.buffer);
  const firstWord = data32[0];

  for (let i = 1; i < data32.length; i += 2) {
    let a = firstWord;
    let b = i;
    let c = key1;
    let d = key2;

    for (let round = 0; round < 22; round++) {
      b = ((b >>> 8) | (b << 24)) + a;
      b ^= c + 38293;
      a = ((a << 3) | (a >>> 29)) ^ b;

      d = ((d >>> 8) | (d << 24)) + c;
      d ^= round + 38293;
      c = ((c << 3) | (c >>> 29)) ^ d;
    }

    data32[i] ^= a;
    if (i + 1 < data32.length) {
      data32[i + 1] ^= b;
    }
  }
}

const decodeCachedPoToken = (identifier: string, encodedPoToken: string) => {
  const data = base64ToBuffer(encodedPoToken);
  transformData(data, identifier);

  let index = 4;
  while (index < 7 && data[index] === 0) index++;

  // Not sure if these ever change, they're hardcoded in the original code. It's obviously for some kind of validation.
  const VALIDATION_BYTES = [196, 200, 224, 18];

  for (let i = 0; i < VALIDATION_BYTES.length; i++) {
    if (data[index++] !== VALIDATION_BYTES[i])
      throw new Error('Validation failed');
  }

  const timestamp = new DataView(data.buffer).getUint32(index);
  index += 4;

  const poToken = bufferToBase64(new Uint8Array(data.buffer, index), true);

  return {
    expires: new Date(timestamp * 1000),
    poToken
  };
}

const getPoToken = (id: int) => {
    console.log(`video-id: ${id}`);
    const contentBinding = id // window.yt.config_["DATASYNC_ID"] || window.yt.config["VISITORDATA"];
    const potKey = window.sessionStorage.getItem("iU5q-!O9@$"); // this is somehow hardcoded into base.js, maybe grep for it using regex if unstable.
    const ids = (potKey ?? "").split(",");
    
    let sessionPoToken;
    
    for (const id of ids) {
      try {
        sessionPoToken = decodeCachedPoToken(contentBinding, window.sessionStorage.getItem(id));
      } catch (e) { /** no-op */ }
    }
    
    return sessionPoToken;
}

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

const captionsForInfo = (info: YT.VideoInfo) => {
    return info.captions.caption_tracks.map((track) => {
        const token = getPoToken(info.basic_info.id).poToken;
        const url = track.base_url + "&pot=" + token + "&fmt=json3&cbr=Chrome&c=WEB";

        console.log(`poToken: ${token}`);

        const def = {
            label: track.name.text,
            language: track.language_code,
            url: url,
            extension: 'srt',
        };
        return {
            id: trackId(def),
            ...def,
        };
    });
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

        console.log(`info: ${JSON.stringify(info)}`);
        const captions = captionsForInfo(info);
        console.log(`captions: ${JSON.stringify(captions)}`);

        // response.subtitles = transcript === undefined ? [] : lazyTracksForTranscript(transcript);
        response.subtitles = transcript === undefined ? [] : captionsForInfo(info);
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
