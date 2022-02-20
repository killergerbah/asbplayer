import { parse as parseAss } from 'ass-compiler';
import { parseSync as parseSrt } from 'subtitle';
import { WebVTT } from 'vtt.js';

const tagRegex = RegExp('</?([^>]*)>', 'ig');
const helperElement = document.createElement('div');

interface SubtitleNode {
    start: number;
    end: number;
    text: string;
    track: number;
}

export default class SubtitleReader {
    async subtitles(files: File[]) {
        return (await Promise.all(files.map((f, i) => this._subtitles(f, i))))
            .flatMap((nodes) => nodes)
            .sort((n1, n2) => n1.start - n2.start);
    }

    async _subtitles(file: File, track: number): Promise<SubtitleNode[]> {
        if (file.name.endsWith('.srt')) {
            const nodes = parseSrt(await file.text());
            return nodes.map((node: any) => ({ ...node.data, track: track }));
        }

        if (file.name.endsWith('.vtt') || file.name.endsWith('.nfvtt')) {
            return new Promise(async (resolve, reject) => {
                const isFromNetflix = file.name.endsWith('.nfvtt');
                const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
                const cues: any[] = [];
                parser.oncue = (c: any) => {
                    if (isFromNetflix) {
                        c.text = c.text.replace(tagRegex, '');

                        const lines = c.text.split('\n');
                        const newLines = [];

                        for (const line of lines) {
                            newLines.push(this._fixRTL(line));
                        }

                        c.text = newLines.join('\n');
                    }
                    cues.push(c);
                };
                parser.onflush = () =>
                    resolve(
                        cues.map((c) => ({
                            start: Math.floor(c.startTime * 1000),
                            end: Math.floor(c.endTime * 1000),
                            text: c.text as string,
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

        if (file.name.endsWith('.ytxml')) {
            const xml = new window.DOMParser().parseFromString(await file.text(), 'text/xml');
            const textNodes = xml.getElementsByTagName('text');
            const subtitles = [];

            for (let index = 0, length = textNodes.length; index < length; index++) {
                const elm = textNodes[index];
                const start = parseFloat(elm.getAttribute('start') as string);

                subtitles.push({
                    start: Math.floor(start * 1000),
                    end: Math.floor((start + parseFloat(elm.getAttribute('dur') as string)) * 1000),
                    text: this._decodeHTML(elm.textContent!.replace(tagRegex, '')),
                    track,
                });
            }

            return subtitles;
        }

        throw new Error('Unsupported subtitle file format');
    }

    _fixRTL(line: string): string {
        const index1 = line.indexOf('&lrm;');
        const index2 = line.indexOf('&rlm;');
        let newLine = '';

        if (index1 > -1) {
            newLine = line.substring(0, index1) + '\u202a' + line.substring(index1 + 5) + '\u202c';
            return this._fixRTL(newLine);
        } else if (index2 > -1) {
            newLine = line.substring(0, index2) + '\u202b' + line.substring(index2 + 5) + '\u202c';
            return this._fixRTL(newLine);
        }

        return line;
    }

    _decodeHTML(text: string): string {
        helperElement.innerHTML = text;
        return helperElement.childNodes.length === 0 ? '' : helperElement.childNodes[0].nodeValue!;
    }
}
