export default class Subtitle {

    constructor(node, length, offset) {
        this.node = node;
        this.length = length;
        this.offset = offset;
        this.displayTime = this._timeDuration(node.start + offset, length + offset)
    }

    static deserialize(serialized) {
        return new Subtitle({
            text: serialized.text,
            start: serialized.start,
            end: serialized.end,
            index: serialized.index
        }, serialized.length, serialized.offset);
    }

    serialize() {
        return {
            ...this.node,
            length: this.length,
            offset: this.offset
        }
    }

    get text() {
        return this.node.text;
    }

    get start() {
        return this.node.start + this.offset;
    }

    get end() {
        return this.node.end + this.offset;
    }

    get originalStart() {
        return this.node.start;
    }

    get originalEnd() {
        return this.node.end;
    }

    get index() {
        return this.node.index;
    }

    offsetBy(offset) {
        return new Subtitle(this.node, this.length, offset);
    }

    _timeDuration(milliseconds, totalMilliseconds) {
        if (milliseconds < 0) {
            return this._timeDuration(0, totalMilliseconds);
        }

        const ms = milliseconds % 1000;
        milliseconds = (milliseconds - ms) / 1000;
        const secs = milliseconds % 60;
        milliseconds = (milliseconds - secs) / 60;
        const mins = milliseconds % 60;

        if (totalMilliseconds >= 3600000) {
            const hrs = (milliseconds - mins) / 60;
            return this._pad(hrs) + ':' + this._pad(mins) + ':' + this._pad(secs) + '.' + this._padEnd(ms);
        }

        return this._pad(mins) + ':' + this._pad(secs) + '.' + this._padEnd(ms);
    }

    _pad(n) {
        return String(n).padStart(2, '0');
    }

    _padEnd(n) {
        return String(n).padEnd(3, '0');
    }
}