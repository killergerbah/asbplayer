export interface BufferAdapter {
    length: number;
    at(index: number): number;
    subarray(start: number, end: number): BufferAdapter;
}

export class Uint8ArrayBuffer implements BufferAdapter {
    private readonly buffer: Uint8Array;

    constructor(buffer: Uint8Array) {
        this.buffer = buffer;
    }

    get length() {
        return this.buffer.length;
    }

    at(index: number): number {
        return this.buffer[index];
    }

    subarray(start: number, end: number) {
        return new Uint8ArrayBuffer(this.buffer.subarray(start, end));
    }
}

export class CompositeBuffer implements BufferAdapter {
    private readonly buffers: BufferAdapter[] = [];

    constructor(buffers: BufferAdapter[]) {
        this.buffers = buffers;
    }

    get length(): number {
        let length = 0;
        for (const b of this.buffers) {
            length += b.length;
        }

        return length;
    }

    at(index: number): number {
        let previousBuffersLength = 0;

        for (const buffer of this.buffers) {
            const bufferIndex = index - previousBuffersLength;

            if (bufferIndex < buffer.length) {
                return buffer.at(bufferIndex);
            }

            previousBuffersLength += buffer.length;
        }

        throw new Error('Out of bounds');
    }

    subarray(start: number, end: number): BufferAdapter {
        const chunks: BufferAdapter[] = [];
        let previousBuffersLength = 0;

        for (const buffer of this.buffers) {
            const startBufferIndex = Math.max(0, start - previousBuffersLength);
            const endBufferIndex = Math.min(buffer.length, end - previousBuffersLength);

            if (endBufferIndex > 0 && startBufferIndex < endBufferIndex) {
                chunks.push(buffer.subarray(startBufferIndex, endBufferIndex));
            }

            previousBuffersLength += buffer.length;
        }

        return new CompositeBuffer(chunks);
    }
}

export class CompositeBufferReader {
    private buffers: Uint8Array[] = [];

    add(buffer: Uint8Array) {
        this.buffers.push(buffer);
    }

    get length(): number {
        let length = 0;

        for (const buffer of this.buffers) {
            length += buffer.length;
        }

        return length;
    }

    read(bytes: number): BufferAdapter {
        if (bytes === 0) {
            return new CompositeBuffer([]);
        }

        const chunks: Uint8Array[] = [];
        let accumulated = 0;

        while (true) {
            if (this.buffers.length === 0) {
                throw new Error('Trying to read more bytes than available');
            }

            const buffer = this.buffers.shift()!;
            const required = bytes - accumulated;

            if (buffer.length === required) {
                chunks.push(buffer);
                break;
            } else if (buffer.length > required) {
                chunks.push(buffer.subarray(0, required));
                this.buffers.unshift(buffer.subarray(required, buffer.length));
                break;
            }

            accumulated += buffer.length;
            chunks.push(buffer);
        }

        return new CompositeBuffer(chunks.map(c => new Uint8ArrayBuffer(c)));
    }
}

export class BufferReader {
    private buffer: BufferAdapter;
    private _index: number = 0;

    constructor(bytes: BufferAdapter) {
        this.buffer = bytes;
    }

    get index() {
        return this._index;
    }

    get hasNext() {
        return this._index < this.buffer.length;
    }

    readHex(bytes: number, limit?: number) {
        if (limit !== undefined && this._index + bytes > limit) {
            return 0;
        }

        let number = 0;
        let digit = 0;
        const from = this._index;
        const to = this._index + bytes - 1;

        for (let i = to; i >= from; --i) {
            number += this.buffer.at(i) << (8 * digit);
            ++digit;
        }

        this._index += bytes;
        return number;
    }

    readBuffer(bytes: number) {
        const buffer = this.buffer.subarray(this.index, this.index + bytes);
        this._index += bytes;
        return buffer;
    }
}
