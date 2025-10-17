import { extractExtension, inferTracks } from '@/pages/util';

export default defineUnlistedScript(() => {
    inferTracks({
        onJson: (value, addTrack, setBasename) => {
            if (value?.tracks instanceof Array) {
                for (const track of value.tracks) {
                    if (
                        track?.kind === 'captions' &&
                        (track?.type === 'text/vtt' || track?.type === 'text/webvtt') &&
                        typeof track?.src === 'string' &&
                        typeof track?.srclang === 'string'
                    ) {
                        const label =
                            typeof track.label === 'string' ? `${track.srclang} - ${track?.label}` : track.srclang;
                        const language = track.srclang.toLowerCase();
                        const url = track.src;

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
