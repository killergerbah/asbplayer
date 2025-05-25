import { extractExtension, inferTracks } from '@/pages/util';

export default defineUnlistedScript(() => {
    inferTracks({
        onJson: (value, addTrack, setBasename) => {
            if (value?.text_tracks instanceof Array) {
                for (const track of value.text_tracks) {
                    if (
                        track.kind === 'captions' &&
                        track.mime_type === 'text/webvtt' &&
                        track.sources instanceof Array &&
                        track.sources.length > 0 &&
                        typeof track.sources[0].src === 'string' &&
                        typeof track.srclang === 'string'
                    ) {
                        const label =
                            typeof track.label === 'string' ? `${track.srclang} - ${track?.label}` : track.srclang;
                        const language = track.srclang.toLowerCase();
                        const url = track.sources[0].src;

                        addTrack({
                            label: label,
                            language: language,
                            url: url.replace(/^http:\/\//, 'https://'),
                            extension: extractExtension(url, 'vtt'),
                        });
                    }
                }

                if (typeof value?.name === 'string') {
                    setBasename(value?.name);
                }
            }
        },
        waitForBasename: true,
    });
});
