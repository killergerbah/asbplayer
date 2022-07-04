import KeySequence from './KeySequence';

export default class KeySequences {
    static toggleSubtitles() {
        // Up S, canceled by 1...9
        return new KeySequence({ up: ['s'], canceledBy: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] });
    }

    static toggleSubtitleTrack() {
        // Holding S, up 1...9
        return new KeySequence({
            holding: ['s'],
            up: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
            map: (event) => Number(event.key) - 1,
        });
    }

    static toggleSubtitleTrackInList() {
        // Holding W, up 1...9
        return new KeySequence({
            holding: ['w'],
            up: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
            map: (event) => Number(event.key) - 1,
        });
    }

    static togglePlay() {
        // Space
        return new KeySequence({
            up: [' '],
            canceledBy: ['a', 'd'],
        });
    }
}
