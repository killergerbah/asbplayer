import { extractExtension } from '@/pages/util';
import { inferTracksFromInterceptedMpdViaXMLHTTPRequest } from '@/pages/mpd-util';

export default defineUnlistedScript(() => {
    const deduplication: { [key: string]: number } = {};

    inferTracksFromInterceptedMpdViaXMLHTTPRequest(/https:\/\/.+\.mpd/, (playlist, language) => {
        const name = playlist.attributes?.NAME;
        const playlistNumber = name in deduplication ? deduplication[name] + 1 : 0;
        deduplication[name] = playlistNumber;
        const deduplicatedName = `${name}-${playlistNumber}`;
        const segmentUrls = playlist.segments.map((s) => s.resolvedUri);
        return {
            label: name === undefined ? language : `${language} - ${deduplicatedName}`,
            language,
            url: segmentUrls,
            extension: extractExtension(playlist.resolvedUri, 'vtt'),
        };
    });
});
