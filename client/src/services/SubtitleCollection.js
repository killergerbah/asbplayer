import IntervalTree from 'node-interval-tree';

export default class SubtitleCollection {

    constructor(subtitles) {
        this.tree = new IntervalTree();

        for (const s of subtitles) {
            this.tree.insert(s.start, s.end, s);
        }

        this.subtitles = subtitles;
    }

    atTimestamp(timestamp) {
        return this.tree.search(timestamp, timestamp);
    }

    get(index) {
        return this.subtitles[index];
    }

    get length() {
        return this.subtitles.length;
    }

    list() {
        return this.subtitles;
    }

    offsetBy(offset) {
        return new SubtitleCollection(this.subtitles.map(s => s.offsetBy(offset)));
    }
}