export class CompositeBuffer {
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

    read(bytes: number): Buffer {
        if (bytes === 0) {
            return Buffer.from([]);
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

        return Buffer.concat(chunks.map((c) => Buffer.from(c)));
    }
}

export class BufferGenerator {
    private stream: ReadableStream;
    private accumulatedBuffer: CompositeBuffer = new CompositeBuffer();

    requestedBytes: number = 0;

    constructor(stream: ReadableStream) {
        this.stream = stream;
    }

    async *buffers() {
        const reader = this.stream.getReader();

        while (true) {
            if (this.accumulatedBuffer.length >= this.requestedBytes) {
                yield this.accumulatedBuffer.read(this.requestedBytes);
            } else {
                const result = await reader.read();

                if (result.done) {
                    break;
                }

                this.accumulatedBuffer.add(result.value as Uint8Array);
            }
        }
    }
}

export class BufferReader {
    private bytes: Uint8Array;
    private _index: number = 0;

    constructor(bytes: Uint8Array) {
        this.bytes = bytes;
    }

    get index() {
        return this._index;
    }

    get hasNext() {
        return this._index < this.bytes.length;
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
            number += this.bytes[i] << (8 * digit);
            ++digit;
        }

        this._index += bytes;
        return number;
    }

    readBuffer(bytes: number) {
        const buffer = Buffer.from(this.bytes.subarray(this.index, this.index + bytes));
        this._index += bytes;
        return buffer;
    }
}
