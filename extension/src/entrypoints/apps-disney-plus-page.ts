import { inferTracksFromInterceptedMpd } from '@/pages/mpd-util';
import { extractExtension } from '@/pages/util';

inferTracksFromInterceptedMpd(/https:\/\/.+\.apps\.disneyplus\..+\.mpd/, (playlist, language: string) => {
    const name = playlist.attributes?.NAME as string | undefined;
    let label = language;

    if (name) {
        if (name.includes('dummy')) {
            return undefined;
        }

        if (name.includes('forced')) {
            language = `${language} - forced`;
            label = `${language} - forced`;
        }
    }

    return {
        label,
        language,
        url: playlist.resolvedUri,
        extension: extractExtension(playlist.resolvedUri, 'vtt'),
    };
});
