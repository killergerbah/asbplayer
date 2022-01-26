import KeySequence from './KeySequence';

export default class KeySequences {
    static toggleSubtitles() {
        // Up S, canceled by 1...9
        return new KeySequence({ up: [83], canceledBy: [49, 50, 51, 52, 53, 54, 55, 56, 57] });
    }

    static toggleSubtitleTrack() {
        // Holding S, up 1...9
        return new KeySequence({
            holding: [83],
            up: [49, 50, 51, 52, 53, 54, 55, 56, 57],
            map: (event) => event.keyCode - 49,
        });
    }

    static toggleSubtitleTrackInList() {
        // Holding D, up 1...9
        return new KeySequence({
            holding: [68],
            up: [49, 50, 51, 52, 53, 54, 55, 56, 57],
            map: (event) => event.keyCode - 49,
        });
    }
}
