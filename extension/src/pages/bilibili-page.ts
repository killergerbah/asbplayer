import { extractExtension, inferTracks } from './util';

inferTracks({
    onJson: (value, addTrack) => {
        if (value?.data?.subtitles instanceof Array) {
            for (const track of value.data.subtitles) {
                if (
                    typeof track.lang === 'string' &&
                    typeof track.lang_key === 'string' &&
                    ((typeof track.srt === 'object' && typeof track.srt.url === 'string') ||
                        typeof track.url === 'string')
                ) {
                    const url = track.srt?.url ?? track.url;
                    const extension = extractExtension(url, 'srt');

                    addTrack({
                        type: "url",
                        label: track.lang,
                        language: track.lang_key,
                        url,
                        extension: extension === 'json' ? 'bbjson' : extension,
                    });
                }
            }
        }
    },
    onRequest: (addTrack, setBasename) => {
        setBasename(document.title);
    },
    waitForBasename: false,
});
