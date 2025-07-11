import { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { trackFromDef } from '@/pages/util';

declare const ApiClient: any | undefined;

export default defineUnlistedScript(() => {
    document.addEventListener(
        'asbplayer-get-synced-data',
        async () => {
            const response: VideoData = { error: '', basename: '', subtitles: [] };
            if (!ApiClient) {
                response.error = 'ApiClient is undefined';
                return document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: response,
                    })
                );
            }

            const deviceID = ApiClient?._deviceId;

            let session;
            for (let attempt = 0; attempt < 5; attempt++) {
                const sessions = await ApiClient.getSessions({ deviceId: deviceID });
                session = sessions[0];
                if (session.PlayState.MediaSourceId) {
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            if (!session || !session.PlayState.MediaSourceId) {
                response.error = 'Failed to retrieve a valid MediaSourceId after 5 attempts';
                return document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: response,
                    })
                );
            }

            const mediaID = session.PlayState.MediaSourceId;
            const nowPlayingItem = session.NowPlayingItem;
            const path = nowPlayingItem.Path;
            response.basename = nowPlayingItem.FileName ?? (path ? path.split(/[\\/]/).pop() : nowPlayingItem.Name);

            const subtitles: VideoDataSubtitleTrack[] = [];
            nowPlayingItem.MediaStreams.filter(
                (stream: { IsTextSubtitleStream: any }) => stream.IsTextSubtitleStream
            ).forEach((sub: { Codec: string; DisplayTitle: any; Language: any; Index: number; Path: string }) => {
                const extension = 'srt';
                var url =
                    '/Videos/' + nowPlayingItem.Id + '/' + mediaID + '/Subtitles/' + sub.Index + '/Stream.' + extension;
                subtitles.push(
                    trackFromDef({
                        label: sub.DisplayTitle,
                        language: sub.Language || '',
                        url: url,
                        extension,
                    })
                );
            });

            response.subtitles = subtitles;

            document.dispatchEvent(
                new CustomEvent('asbplayer-synced-data', {
                    detail: response,
                })
            );
        },
        false
    );
});
