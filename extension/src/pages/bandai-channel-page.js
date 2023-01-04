let basename = undefined;
let subtitles = [];

setTimeout(() => {
    const originalParse = JSON.parse;

    JSON.parse = function () {
        const value = originalParse.apply(this, arguments);

        if (value?.bc?.text_tracks instanceof Array) {
            subtitles = [];

            for (const track of value.bc.text_tracks) {
                if (
                    track.kind === 'subtitles' &&
                    track.mime_type === 'text/webvtt' &&
                    track.sources instanceof Array &&
                    track.sources.length > 0 &&
                    typeof track.sources[0].src === 'string' &&
                    typeof track.srclang === 'string'
                ) {
                    const label =
                        typeof track.label === 'string' ? `${track.srclang} - ${track?.label}` : track.srclang;

                    subtitles.push({
                        label: label,
                        language: track.srclang.toLowerCase(),
                        url: track.sources[0].src.replace(/^http:\/\//, 'https://'),
                    });
                }
            }

            if (typeof value?.name === 'string') {
                basename = value?.name;
            }
        }

        return value;
    };
}, 0);

document.addEventListener(
    'asbplayer-get-synced-data',
    () => {
        const response = { error: '', basename: basename ?? document.title, extension: 'vtt', subtitles: subtitles };
        document.dispatchEvent(
            new CustomEvent('asbplayer-synced-data', {
                detail: response,
            })
        );
        basename = undefined;
        subtitles = [];
    },
    false
);
