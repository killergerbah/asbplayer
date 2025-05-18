import { extractExtension, inferTracks, poll } from '@/pages/util';

export default defineUnlistedScript(() => {
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

    inferTracks({
        onJson: (value, addTrack, setBasename) => {
            let basename: string | undefined;

            if (value?.bc?.text_tracks instanceof Array) {
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
                        const url = track.sources[0].src.replace(/^http:\/\//, 'https://');
                        addTrack({
                            label: label,
                            language: track.srclang.toLowerCase(),
                            url: url,
                            extension: extractExtension(url, 'vtt'),
                        });
                    }
                }

                if (typeof value.bc.name === 'string') {
                    basename = value.bc.name;
                    setBasename(value.bc.name);
                }
            }

            if (basename === undefined && typeof value?.bch?.episode_title === 'string') {
                basename = value.bch.episode_title;
                setBasename(value.bch.episode_title);
            }
        },
        onRequest: async (addTrack, setBasename) => {
            const succeeded = await poll(() => {
                const basename = basenameFromDOM();

                if (basename) {
                    setBasename(basename);
                    return true;
                }

                return false;
            });

            if (!succeeded) {
                setBasename(document.title);
            }
        },
        waitForBasename: true,
    });
});
