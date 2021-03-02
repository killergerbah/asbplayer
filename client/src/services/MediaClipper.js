const AUDIO_TYPES = {"audio/ogg;codecs=opus": "ogg", "audio/webm;codecs=opus": "webm"}

export default class MediaClipper {

    async clipAndSaveAudio(file, start, end, trackId) {
        const [blob, extension] = await this.clipAudio(file, start, end, trackId);
        await this._saveToFile(blob,  this._nameWithoutExtension(file.name) + "_" + start + "_" + end + "." + extension);
    }

    async clipAudio(file, start, end, trackId) {
        return new Promise((resolve, reject) => {
                const media = new Audio();
                media.src = URL.createObjectURL(file);
                media.preload = "none";

                // FIXME: clipping the correct audio track selection doesn't actually work right now.
                if (trackId && media.audioTracks && media.audioTracks.length > 0) {
                    for (const t of media.audioTracks) {
                        t.enabled = trackId === t.id;
                    }
                }

                media.currentTime = start / 1000;
                media.load();

                media.oncanplay = (e) => {
                    media.play();
                    const stream = this._captureStream(media);

                    for (const t of stream.getVideoTracks()) {
                        t.stop();
                    }

                    const [mimeType, extension] = this._findMediaType();
                    const recorder = new MediaRecorder(stream, { mimeType: mimeType });
                    const chunks = [];
                    recorder.ondataavailable = (e) => {
                        chunks.push(e.data);
                    };
                    recorder.onstop = (e) => {
                        resolve([new Blob(chunks), extension]);
                    };
                    recorder.start();
                    setTimeout(() => {
                        media.pause();
                        recorder.stop();
                        const src = media.src;
                        media.src = null;
                        URL.revokeObjectURL(src);
                    }, end - start + 100);
                };
        });
    }

    async saveAudio(base64, extension) {
        const res = await fetch("data:audio/" + extension + ";base64," + base64);
        const blob = await res.blob();
        this._saveToFile(blob, "audio_" + Date.now() + "." + extension);
    }

    _nameWithoutExtension(fileName) {
        return fileName.substring(0, fileName.lastIndexOf("."));
    }

    _saveToFile(blob, name) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    }

    _findMediaType() {
        return Object.keys(AUDIO_TYPES)
                .filter(MediaRecorder.isTypeSupported)
                .map(t => [t, AUDIO_TYPES[t]])[0];
    }

    _captureStream(media) {
        if (typeof media.captureStream === "function") {
            return media.captureStream();
        }

        if (typeof media.mozCaptureStream === "function") {
            return media.mozCaptureStream();
        }

        throw new Error("Unable to capture stream from media");
    }
}