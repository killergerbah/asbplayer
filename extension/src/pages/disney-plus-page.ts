import { inferTracks } from './util';
import { subtitleTrackSegmentsFromM3U8 } from './m3u8-util';

setTimeout(() => {
    function basenameFromDOM(): string {
        const titleElements = document.getElementsByClassName('title-field');
        const subtitleElements = document.getElementsByClassName('subtitle-field');
        let title: string | null = null;
        let subtitle: string | null = null;

        if (titleElements.length > 0) {
            title = titleElements[0].textContent;
        }

        if (subtitleElements.length > 0) {
            subtitle = subtitleElements[0].textContent;
        }

        if (title === null) {
            return '';
        }

        if (subtitle === null) {
            return title;
        }

        return `${title} ${subtitle}`;
    }

    async function basenameFromDOMWithRetries(retries: number): Promise<string | undefined> {
        const basename = basenameFromDOM();

        if (retries === 0) {
            return basename;
        }

        if (basename === '') {
            return new Promise((resolve, reject) => {
                setTimeout(async () => resolve(await basenameFromDOMWithRetries(retries - 1)), 1000);
            });
        }

        return undefined;
    }

    let lastM3U8Url: string | undefined = undefined;

    const originalParse = JSON.parse;
    JSON.parse = function () {
        // @ts-ignore
        const value = originalParse.apply(this, arguments);
        if (value?.stream?.sources instanceof Array && value.stream.sources.length > 0) {
            const url = value.stream.sources[0].complete?.url;

            if (url) {
                lastM3U8Url = url;
            }
        }

        return value;
    };
    inferTracks(
        {
            onRequest: async (addTrack, setBasename) => {
                setBasename((await basenameFromDOMWithRetries(10)) ?? '');

                if (lastM3U8Url !== undefined) {
                    const tracks = await subtitleTrackSegmentsFromM3U8(lastM3U8Url);

                    for (const track of tracks) {
                        addTrack(track);
                    }
                }
            },
            waitForBasename: false,
        },
        60_000
    );
}, 0);
