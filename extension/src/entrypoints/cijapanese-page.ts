import { VideoData } from '@project/common';

export default defineUnlistedScript(() => {
    document.addEventListener('asbplayer-get-synced-data', () => {
        const tracks = Array.from(document.querySelectorAll("video track"));
        const subtitles = tracks.map((track, index)=>({
            id: (index+1).toString(),
            label: track.getAttribute("label"),
            language: track.getAttribute("srclang"),
            url: track.getAttribute("src"),
            extension: track.getAttribute("src").split(".").at(-1),
        }));

        const response: VideoData = {
            error: "",
            basename: document.title.replace(" | Comprehensible Japanese", ""),
            subtitles,
        };
        document.dispatchEvent(new CustomEvent('asbplayer-synced-data', { detail: response }));
    });
});