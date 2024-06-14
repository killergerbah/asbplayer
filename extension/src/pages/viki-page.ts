import { inferTracksFromInterceptedMpd } from './mpd-util';
import { extractExtension } from './util';

inferTracksFromInterceptedMpd(/https:\/\/.+\.viki\..+manifest\.mpd/, (playlist, language) => {
    const name = playlist.attributes?.NAME;
    return {
        type: "url",
        label: name === undefined ? language : `${language} - ${name}`,
        language,
        url: playlist.resolvedUri,
        extension: extractExtension(playlist.resolvedUri, 'vtt'),
    };
});
