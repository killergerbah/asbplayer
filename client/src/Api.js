export default function Api() {
    this.baseUrl = "http://localhost:8080";

    function encode(path) {
        return path.replaceAll('/', '\\').split('\\').map((part) => encodeURIComponent(part)).join('/');
    };

    this.list = function(path) {
        return fetch(this.baseUrl + "/ls/" + encode(path))
            .then(response => response.json())
    };

    this.subtitles = function(path) {
        return fetch(this.baseUrl + "/subtitle/" + encode(path))
            .then(response => response.json())
    };

    this.streamingUrl = function(path) {
        return this.baseUrl + "/stream/" + encode(path);
    };

    this.clipAudio = function(fileName, path, start, end, trackId) {
        return fetch(this.baseUrl + "/clip/audio", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: path,
                start: start,
                end: end,
                trackId: trackId
            })
        })
        .then(response => {
            if(response.status !== 200) {
                throw new Error('Failed to clip audio: ' + response.status);
            }

            return response.blob();
        })
        .then(blob => {
            const a = document.createElement("a");
            document.body.appendChild(a);
            a.style = "display: none";
            const url = window.URL.createObjectURL(blob);
            a.href = url;
            a.download = fileName + "_" + start + "_" + end + ".mp3";
            a.click();
            window.URL.revokeObjectURL(url);
        });
    }
}