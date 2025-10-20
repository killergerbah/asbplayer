import { VideoData } from '@project/common';
export default defineUnlistedScript(() => {
    document.addEventListener('asbplayer-get-synced-data', () => {
        const tracks = Array.from(document.querySelectorAll("video track"));
        const subtitles = [];

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const url = track.getAttribute("src");
            const label = track.getAttribute("label");
            const language = track.getAttribute("srclang");
            
            if (!url || !label || !language) continue;

            const extension = url.split(".").at(-1) || "";
            subtitles.push({
                id: (subtitles.length).toString(),
                label,
                language,
                url,
                extension,
            });
        }

        const response: VideoData = {
            error: "",
            basename: document.title.replace(" | Comprehensible Japanese", ""),
            subtitles,
        };
        document.dispatchEvent(new CustomEvent('asbplayer-synced-data', { detail: response }));
    });
});
