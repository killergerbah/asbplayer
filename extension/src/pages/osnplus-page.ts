import { inferTracksFromInterceptedMpd } from './mpd-util';
import { extractExtension } from './util';

inferTracksFromInterceptedMpd(/https:\/\/(.+\.)?osn\.com.+\.mpd/, (playlist, language) => {
    const name = playlist.attributes?.NAME;
    return {
        label: name === undefined ? language : `${language} - ${name}`,
        language,
        url: playlist.resolvedUri,
        extension: extractExtension(playlist.resolvedUri, 'vtt'),
    };
});
