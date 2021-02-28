import { parseSync } from 'subtitle';
import { parse } from 'ass-compiler';

export default class SubtitleReader {

    async subtitles(file) {
        if (file.name.endsWith('.srt')) {
            return file.text()
                .then(text => {
                    return parseSync(text)
                })
                .then(nodes => {
                    return nodes.map(node => node.data).sort((n1, n2) => n1.start - n2.start);
                });
        }

        if (file.name.endsWith('.ass')) {
            return file.text()
                .then(text => {
                    return parse(text);
                })
                .then(parsed => {
                    return parsed.events.dialogue.map(event => {
                        return {
                            start: Math.round(event.Start * 1000),
                            end: Math.round(event.End * 1000),
                            text: event.Text.combined
                        };
                    })
                    .sort((n1, n2) => n1.start - n2.start)
                });
        }

        throw new Error('Unsupported subtitle file format');
    }
}