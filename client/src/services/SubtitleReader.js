import { parseSync as parseSrt } from 'subtitle';
import { parse as parseAss } from 'ass-compiler';
import { WebVTT } from 'vtt.js';

export default class SubtitleReader {
    async subtitles(files) {
        return (await Promise.all(files.map((f, i) => this._subtitles(f, i))))
            .flatMap((nodes) => nodes)
            .sort((n1, n2) => n1.start - n2.start);
    }

    async _subtitles(file, track) {
        if (file.name.endsWith('.srt')) {
            const nodes = parseSrt(await file.text());
            return nodes.map((node) => ({ ...node.data, track: track }));
        }

        if (file.name.endsWith('.vtt')) {
            return new Promise(async (resolve, reject) => {
                const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
                const cues = [];
                parser.oncue = (c) => cues.push(c);
                parser.onflush = () =>
                    resolve(
                        cues.map((c) => ({
                            start: Math.floor(c.startTime * 1000),
                            end: Math.floor(c.endTime * 1000),
                            text: c.text,
                            track: track,
                        }))
                    );
                parser.parse(await file.text());
                parser.flush();
            });
        }

        if (file.name.endsWith('.ass')) {
            const nodes = parseAss(await file.text());
            return nodes.events.dialogue.map((event) => ({
                start: Math.round(event.Start * 1000),
                end: Math.round(event.End * 1000),
                text: event.Text.combined,
                track: track,
            }));
        }

        throw new Error('Unsupported subtitle file format');
    }
}
