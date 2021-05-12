import { parseSync as parseSrt } from 'subtitle';
import { parse as parseAss } from 'ass-compiler';
import { WebVTT } from 'vtt.js';
import Subtitle from './Subtitle';
import SubtitleCollection from './SubtitleCollection';

export default class SubtitleReader {

    async subtitles(file) {
        const subtitlesList = (await this._parse(file))
            .sort((n1, n2) => {
                const startDiff = n1.start - n2.start;

                if (startDiff !== 0) {
                    return startDiff;
                }

                return n1.end - n2.end;
            });

        if (subtitlesList.length === 0) {
            return new SubtitleCollection([]);
        }

        const length = subtitlesList[subtitlesList.length - 1].end;

        return new SubtitleCollection(
            subtitlesList
                .map((s, index) => new Subtitle({
                    ...s,
                    index: index
                }, length, 0))
        );
    }

    async _parse(file) {
        if (file.name.endsWith('.srt') ) {
            const nodes = parseSrt(await file.text());
            return nodes.map(node => node.data);
        }

        if (file.name.endsWith('.vtt')) {
            return new Promise(async (resolve, reject) => {
                const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
                const cues = [];
                parser.oncue = (c) => cues.push(c);
                parser.onflush = () => resolve(
                    cues
                        .map((c) => ({
                            start: Math.floor(c.startTime * 1000),
                            end: Math.floor(c.endTime * 1000),
                            text: c.text
                        }))
                );
                parser.parse(await file.text());
                parser.flush();
            });
        }

        if (file.name.endsWith('.ass')) {
            const nodes = parseAss(await file.text());
            return nodes.events.dialogue.map(event => ({
                start: Math.round(event.Start * 1000),
                end: Math.round(event.End * 1000),
                text: event.Text.combined
            }));
        }

        throw new Error('Unsupported subtitle file format');
    }
}