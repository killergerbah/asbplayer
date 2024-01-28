import { extractExtension, inferTracks } from './util';

inferTracks({
    onJson: (value, addTrack) => {
        if (value?.subtitleUrls instanceof Array) {
            for (const track of value.subtitleUrls) {
                if (
                    typeof value?.catalogMetadata?.catalog?.title === 'string' &&
                    typeof track.url === 'string' &&
                    typeof track.languageCode === 'string' &&
                    typeof track.displayName === 'string'
                ) {
                    const label = `${value.catalogMetadata.catalog.title} ${track.displayName}`;

                    addTrack({
                        label: label,
                        language: track.languageCode.toLowerCase(),
                        url: track.url,
                        extension: extractExtension(track.url, 'dfxp'),
                    });
                }
            }
        }
    },
    waitForBasename: false,
});
