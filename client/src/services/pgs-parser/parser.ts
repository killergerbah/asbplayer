import { BufferGenerator, BufferReader } from './buffer';
import {
    CompositionState,
    compositionStateFromByte,
    LastInSequenceFlag,
    lastInSequenceFlagFromByte,
    objectCroppedFlagFromByte,
    ObjectDefinitionSegment,
    PaletteDefinitionSegment,
    PaletteEntry,
    paletteUpdateFlagFromByte,
    PresentationCompositionSegment,
    Segment,
    SegmentHeader,
    SegmentType,
    segmentTypeFromByte,
    WindowDefinitionSegment,
} from './segment';

const pgMagicNumber = 20551; // 0x5047

export class RunLengthEncodedBuffer {
    private readonly fragments: Buffer[];

    constructor(fragments: Buffer[]) {
        this.fragments = fragments;
    }

    decode(callback: (x: number, y: number, color: number) => void) {
        let encodedIndex = 0;
        let decodedLineIndex = 0;
        let currentLine = 0;
        const encodedLength = this.encodedLength();

        while (encodedIndex < encodedLength) {
            const firstByte = this.encodedByte(encodedIndex);
            let runLength;
            let color;
            let increment;

            // Deal with each possible code
            if (firstByte > 0) {
                // CCCCCCCC	- One pixel in color C
                color = firstByte;
                runLength = 1;
                increment = 1;
            } else {
                const secondByte = this.encodedByte(encodedIndex + 1);

                if (secondByte === 0) {
                    // 00000000 00000000 - End of line
                    color = 0;
                    runLength = 0;
                    increment = 2;
                    decodedLineIndex = 0;
                    ++currentLine;
                } else if (secondByte < 64) {
                    // 00000000 00LLLLLL - L pixels in color 0 (L between 1 and 63)
                    color = 0;
                    runLength = secondByte;
                    increment = 2;
                } else if (secondByte < 128) {
                    // 00000000 01LLLLLL LLLLLLLL - L pixels in color 0 (L between 64 and 16383)
                    const thirdByte = this.encodedByte(encodedIndex + 2);
                    color = 0;
                    runLength = ((secondByte - 64) << 8) + thirdByte;
                    increment = 3;
                } else if (secondByte < 192) {
                    // 00000000 10LLLLLL CCCCCCCC - L pixels in color C (L between 3 and 63)
                    const thirdByte = this.encodedByte(encodedIndex + 2);
                    color = thirdByte;
                    runLength = secondByte - 128;
                    increment = 3;
                } else {
                    // 00000000 11LLLLLL LLLLLLLL CCCCCCCC - L pixels in color C (L between 64 and 16383)
                    const thirdByte = this.encodedByte(encodedIndex + 2);
                    const fourthByte = this.encodedByte(encodedIndex + 3);
                    color = fourthByte;
                    runLength = ((secondByte - 192) << 8) + thirdByte;
                    increment = 4;
                }
            }

            if (runLength > 0) {
                for (let x = decodedLineIndex; x < decodedLineIndex + runLength; ++x) {
                    callback(x, currentLine, color);
                }
                // decodedLine.fill(color, decodedLineIndex, decodedLineIndex + runLength);
                decodedLineIndex += runLength;
            }

            encodedIndex += increment;
        }
    }

    private encodedLength() {
        let length = 0;

        for (const fragment of this.fragments) {
            length += fragment.length;
        }

        return length;
    }

    private encodedByte(index: number) {
        let previousFragmentsLength = 0;

        for (const fragment of this.fragments) {
            const fragmentIndex = index - previousFragmentsLength;

            if (fragmentIndex < fragment.length) {
                return fragment[fragmentIndex];
            }

            previousFragmentsLength += fragment.length;
        }

        throw new Error(`Index out of range: ${index}`);
    }
}

export class DisplaySet {
    readonly presentationCompositionSegment: PresentationCompositionSegment;
    readonly windowDefinitionSegments: WindowDefinitionSegment[];
    readonly paletteDefinitionSegments: PaletteDefinitionSegment[];
    readonly objectDefinitionSegments: ObjectDefinitionSegment[];
    readonly endDefinitionSegment: Segment;

    private readonly previousDisplaySet?: DisplaySet;

    constructor(
        presentationCompositionSegment: PresentationCompositionSegment,
        windowDefinitionSegments: WindowDefinitionSegment[],
        paletteDefinitionSegments: PaletteDefinitionSegment[],
        objectDefinitionSegments: ObjectDefinitionSegment[],
        endDefinitionSegment: Segment,
        previousDisplaySet?: DisplaySet
    ) {
        this.presentationCompositionSegment = presentationCompositionSegment;
        this.windowDefinitionSegments = windowDefinitionSegments;
        this.paletteDefinitionSegments = paletteDefinitionSegments;
        this.objectDefinitionSegments = objectDefinitionSegments;
        this.endDefinitionSegment = endDefinitionSegment;
        this.previousDisplaySet = previousDisplaySet;
    }

    get firstOds() {
        return this.objectDefinitionSegments.find(
            (ods) =>
                ods.lastInSequenceFlag === LastInSequenceFlag.firstInSequence ||
                ods.lastInSequenceFlag === LastInSequenceFlag.firstAndLastInSequence
        );
    }

    protected paletteDefinitionSegment(paletteId: number): PaletteDefinitionSegment | undefined {
        const pds = this.paletteDefinitionSegments.find((s) => s.paletteId === paletteId);

        if (pds === undefined) {
            if (this.presentationCompositionSegment.compositionState !== CompositionState.normal) {
                throw new Error(`PCS references invalid PDS and composition state is not 'normal'`);
            }

            if (this.previousDisplaySet === undefined) {
                throw new Error(`PCS references invalid PDS and no previous display set to fallback to`);
            }

            return this.previousDisplaySet.paletteDefinitionSegment(paletteId);
        }

        return pds;
    }

    imageData(buffer?: Uint8ClampedArray) {
        const pds = this.paletteDefinitionSegment(this.presentationCompositionSegment.paletteId);

        if (pds === undefined) {
            throw new Error(`PCS references invalid PDS`);
        }

        const firstOds = this.firstOds;

        if (firstOds === undefined || firstOds.width === undefined || firstOds.height === undefined) {
            throw new Error(`Missing first ODS with defined width and height`);
        }

        const imageDataArray = buffer ?? new Uint8ClampedArray(firstOds.width * firstOds.height * 4);
        const rgbaPalette = pds.paletteEntries.map((palette) => this.ycrcbToRgba(palette));
        const width = firstOds.width;

        new RunLengthEncodedBuffer(this.objectDefinitionSegments.map((ods) => ods.objectData)).decode(
            (x, y, paletteIndex) => {
                const pixelIndex = y * width + x;
                const imageDataOffset = pixelIndex * 4;

                if (paletteIndex >= rgbaPalette.length) {
                    imageDataArray[imageDataOffset] = 0;
                    imageDataArray[imageDataOffset + 1] = 0;
                    imageDataArray[imageDataOffset + 2] = 0;
                    imageDataArray[imageDataOffset + 3] = 0;
                } else {
                    const color = rgbaPalette[paletteIndex];
                    imageDataArray[imageDataOffset] = color.r;
                    imageDataArray[imageDataOffset + 1] = color.g;
                    imageDataArray[imageDataOffset + 2] = color.b;
                    imageDataArray[imageDataOffset + 3] = color.a;
                }
            }
        );

        return new ImageData(
            imageDataArray.subarray(0, 4 * firstOds.width * firstOds.height),
            firstOds.width,
            firstOds.height
        );
    }

    // https://stackoverflow.com/questions/21264648/javascript-convert-yuv-to-rgb
    private ycrcbToRgba(palette: PaletteEntry) {
        const y = palette.luminance;
        const cb = palette.colorDifferenceBlue;
        const cr = palette.colorDifferenceRed;

        const r = this.clamp(Math.floor(y + 1.4075 * (cr - 128)), 0, 255);
        const g = this.clamp(Math.floor(y - 0.3455 * (cb - 128) - 0.7169 * (cr - 128)), 0, 255);
        const b = this.clamp(Math.floor(y + 1.779 * (cb - 128)), 0, 255);
        return { r, g, b, a: palette.transparency };
    }

    private clamp(number: number, min: number, max: number) {
        return Math.max(min, Math.min(max, number));
    }
}

export async function* parseDisplaySets(s: ReadableStream) {
    const bufferGenerator = new BufferGenerator(s);
    bufferGenerator.requestedBytes = 13;

    let header: SegmentHeader | undefined;
    let lastDisplaySet: DisplaySet | undefined;
    let presentationCompositionSegment: PresentationCompositionSegment | undefined;
    let windowDefinitionSegments: WindowDefinitionSegment[] = [];
    let paletteDefinitionSegments: PaletteDefinitionSegment[] = [];
    let objectDefinitionSegments: ObjectDefinitionSegment[] = [];

    for await (const buffer of bufferGenerator.buffers()) {
        const reader = new BufferReader(buffer);

        if (header) {
            switch (header.segmentType) {
                case SegmentType.pcs:
                    if (presentationCompositionSegment !== undefined) {
                        throw new Error(`Unexpected PDS`);
                    }

                    presentationCompositionSegment = parsePcsSegment(reader, header);
                    break;
                case SegmentType.wds:
                    if (presentationCompositionSegment === undefined) {
                        throw new Error(`Unexpected WDS`);
                    }

                    windowDefinitionSegments.push(parseWdsSegment(reader, header));
                    break;
                case SegmentType.pds:
                    if (presentationCompositionSegment === undefined) {
                        throw new Error(`Unexpected PDS`);
                    }

                    paletteDefinitionSegments.push(parsePdsSegment(reader, header));
                    break;
                case SegmentType.ods:
                    if (presentationCompositionSegment === undefined) {
                        throw new Error(`Unexpected ODS`);
                    }

                    const ods = parseOdsSegment(reader, header);
                    objectDefinitionSegments.push(ods);
                    break;
                case SegmentType.end:
                    if (presentationCompositionSegment === undefined) {
                        throw new Error(`Unexpected end segment`);
                    }

                    const endDefinitionSegment = { header };
                    lastDisplaySet = new DisplaySet(
                        presentationCompositionSegment,
                        windowDefinitionSegments,
                        paletteDefinitionSegments,
                        objectDefinitionSegments,
                        endDefinitionSegment,
                        lastDisplaySet
                    );

                    yield lastDisplaySet;

                    presentationCompositionSegment = undefined;
                    windowDefinitionSegments = [];
                    paletteDefinitionSegments = [];
                    objectDefinitionSegments = [];
                    break;
                default:
                    throw new Error(`Unknown segment type: ${header.segmentType}`);
            }

            header = undefined;
            bufferGenerator.requestedBytes = 13;
        } else {
            const magicNumber = reader.readHex(2);

            if (magicNumber !== pgMagicNumber) {
                throw new Error(`Invalid magic number: ${magicNumber}`);
            }

            const presentationTimestamp = reader.readHex(4);
            const decodingTimestamp = reader.readHex(4);
            const segmentType = segmentTypeFromByte(reader.readHex(1));
            const segmentSize = reader.readHex(2);
            header = { presentationTimestamp, decodingTimestamp, segmentType, segmentSize };
            bufferGenerator.requestedBytes = segmentSize;
        }
    }
}

function parsePcsSegment(reader: BufferReader, header: SegmentHeader): PresentationCompositionSegment {
    const limit = reader.index + header.segmentSize;
    const width = reader.readHex(2, limit);
    const height = reader.readHex(2, limit);
    reader.readHex(1); // ignore frame rate
    const compositionNumber = reader.readHex(2, limit);
    const compositionState = compositionStateFromByte(reader.readHex(1, limit));
    const paletteUpdateFlag = paletteUpdateFlagFromByte(reader.readHex(1, limit));
    const paletteId = reader.readHex(1, limit);
    const compositionObjectCount = reader.readHex(1, limit);
    const objectId = reader.readHex(2, limit);
    const windowId = reader.readHex(1, limit);
    const objectCroppedFlag = objectCroppedFlagFromByte(reader.readHex(1, limit));
    const objectHorizontalPosition = reader.readHex(2, limit);
    const objectVerticalPosition = reader.readHex(2, limit);
    const objectCroppingHorizontalPosition = reader.readHex(2, limit);
    const objectCroppingVerticalPosition = reader.readHex(2, limit);
    const objectCroppingWidth = reader.readHex(2, limit);
    const objectCroppingHeightPosition = reader.readHex(2, limit);

    return {
        header,
        width,
        height,
        compositionNumber,
        compositionState,
        paletteUpdateFlag,
        paletteId,
        compositionObjectCount,
        objectId,
        windowId,
        objectCroppedFlag,
        objectHorizontalPosition,
        objectVerticalPosition,
        objectCroppingHorizontalPosition,
        objectCroppingVerticalPosition,
        objectCroppingWidth,
        objectCroppingHeightPosition,
    };
}

function parseWdsSegment(reader: BufferReader, header: SegmentHeader): WindowDefinitionSegment {
    const limit = reader.index + header.segmentSize;
    const windowCount = reader.readHex(1, limit);
    const windowDefinitions = [];

    for (let i = 0; i < windowCount; ++i) {
        const windowId = reader.readHex(1, limit);
        const windowHorizontalPosition = reader.readHex(2, limit);
        const windowVerticalPosition = reader.readHex(2, limit);
        const windowWidth = reader.readHex(2, limit);
        const windowHeight = reader.readHex(2, limit);

        windowDefinitions.push({
            windowId,
            windowHorizontalPosition,
            windowVerticalPosition,
            windowWidth,
            windowHeight,
        });
    }

    return {
        header,
        windowCount,
        windowDefinitions,
    };
}

function parsePdsSegment(reader: BufferReader, header: SegmentHeader): PaletteDefinitionSegment {
    const limit = reader.index + header.segmentSize;
    const paletteId = reader.readHex(1, limit);
    const paletteVersionNumber = reader.readHex(1, limit);
    const paletteEntries: PaletteEntry[] = [];

    while (reader.index < limit) {
        const paletteEntryId = reader.readHex(1, limit);
        const luminance = reader.readHex(1, limit);
        const colorDifferenceRed = reader.readHex(1, limit);
        const colorDifferenceBlue = reader.readHex(1, limit);
        const transparency = reader.readHex(1, limit);
        paletteEntries.push({ paletteEntryId, luminance, colorDifferenceRed, colorDifferenceBlue, transparency });
    }

    return {
        header,
        paletteId,
        paletteVersionNumber,
        paletteEntries,
    };
}

function parseOdsSegment(reader: BufferReader, header: SegmentHeader): ObjectDefinitionSegment {
    const objectId = reader.readHex(2);
    const objectVersionNumber = reader.readHex(1);
    const lastInSequenceFlag = lastInSequenceFlagFromByte(reader.readHex(1));
    const objectDataLength = reader.readHex(3);
    let width: number | undefined;
    let height: number | undefined;
    let objectData: Buffer;

    if (
        lastInSequenceFlag === LastInSequenceFlag.firstInSequence ||
        lastInSequenceFlag === LastInSequenceFlag.firstAndLastInSequence
    ) {
        width = reader.readHex(2);
        height = reader.readHex(2);
        objectData = reader.readBuffer(objectDataLength - 4);
    } else {
        objectData = reader.readBuffer(objectDataLength);
    }

    return {
        header,
        objectId,
        objectVersionNumber,
        lastInSequenceFlag,
        objectDataLength,
        width,
        height,
        objectData: objectData,
    };
}
