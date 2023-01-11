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

            if (typeof value.bc.name === 'string') {
                basename = value.bc.name;
            }
        }

        if (basename === undefined && typeof value?.bch?.episode_title === 'string') {
            basename = value.bch.episode_title
        }

        return value;
    };
}, 0);

function basenameFromDOM() {
    const seriesElement = document.getElementById('bch-series-title');
    const episodeElement = document.getElementById('bch-story-title');

    if (!seriesElement || !episodeElement) {
        return undefined;
    }

    if (!seriesElement.textContent) {
        return undefined;
    }

    if (!episodeElement.childNodes || episodeElement.childNodes.length === 0) {
        return undefined;
    }

    return `${seriesElement.textContent} ${episodeElement.childNodes[0].nodeValue}`;
}

document.addEventListener(
    'asbplayer-get-synced-data',
    () => {
        const response = {
            error: '',
            basename: basename ?? basenameFromDOM() ?? document.title,
            extension: 'vtt',
            subtitles: subtitles,
        };
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
