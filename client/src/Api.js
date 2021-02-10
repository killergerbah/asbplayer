import { parseSync } from 'subtitle';
import { parse } from 'ass-compiler';

export default class Api {

    subtitles(file) {
        if (file.name.endsWith('.srt')) {
            return file.text()
                .then(text => {
                    return parseSync(text)
                })
                .then(nodes => {
                    return nodes.map(node => node.data);
                });
        } else if (file.name.endsWith('.ass')) {
            return file.text()
                .then(text => {
                    return parse(text);
                })
                .then(parsed => {
                    return parsed.events.dialogue.map(event => {
                        return {
                            start: Math.round(event.Start * 1000),
                            end: Math.round(event.End * 1000),
                            text: event.Text.raw
                        };
                    });
                });
        }

        throw new Error('Unsupported subtitle file format');
    }

    clipAudioFromAudioFile(file, start, end, trackId) {
        return new Promise((resolve, reject) => {
            const audio = document.createElement("audio");
            this._clipMedia(audio, file, start, end, trackId, resolve);
        });
    }

    clipAudioFromVideoFile(file, start, end, trackId) {
        return new Promise((resolve, reject) => {
            const video = document.createElement("video");
            this._clipMedia(video, file, start, end, trackId, resolve);
        });
    }

    _clipMedia(media, file, start, end, trackId, resolve) {
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
            const stream = media.captureStream();

            for (const t of stream.getVideoTracks()) {
                t.enabled = false;
            }

            const recorder = new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = (e) => {
                chunks.push(e.data);
            };
            recorder.onstop = (e) => {
                this._saveToFile(
                    new Blob(chunks),
                    this._nameWithoutExtension(file.name) + "_" + start + "_" + end + ".wav"
                );

                resolve();
            };
            recorder.start();
            setTimeout(() => {
                recorder.stop();
                media.pause();
                const src = media.src;
                media.src = null;
                URL.revokeObjectURL(src);
            }, end - start);
        };
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
}