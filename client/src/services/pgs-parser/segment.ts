import { BufferAdapter } from "./buffer";

export enum SegmentType {
    pds = 20,
    ods = 21,
    pcs = 22,
    wds = 23,
    end = 128,
}

const segmentTypeValues = Object.values(SegmentType);

export function segmentTypeFromByte(byte: number) {
    for (const type of segmentTypeValues) {
        if (byte === type) {
            return type;
        }
    }

    throw new Error(`Invalid segment type byte: ${byte}`);
}

export enum CompositionState {
    normal = 0,
    acquisitionState = 64,
    epochStart = 128,
}

const compositionStateValues = Object.values(CompositionState);

export function compositionStateFromByte(byte: number) {
    for (const state of compositionStateValues) {
        if (byte === state) {
            return state;
        }
    }

    throw new Error(`Invalid composition state byte: ${byte}`);
}

export function paletteUpdateFlagFromByte(byte: number) {
    switch (byte) {
        case 0:
            return false;
        case 128:
            return true;
        default:
            throw new Error(`Invalid palette update flag byte: ${byte}`);
    }
}

export function objectCroppedFlagFromByte(byte: number) {
    switch (byte) {
        case 0:
            return false;
        case 64:
            return true;
        default:
            throw new Error(`Invalid object cropped flag byte: ${byte}`);
    }
}

export enum LastInSequenceFlag {
    lastInSequence = 64,
    firstInSequence = 128,
    firstAndLastInSequence = 192,
}

const lastInSequenceFlagValues = Object.values(LastInSequenceFlag);

export function lastInSequenceFlagFromByte(byte: number) {
    for (const flag of lastInSequenceFlagValues) {
        if (byte === flag) {
            return flag;
        }
    }

    throw new Error(`Invalid last in sequence flag byte: ${byte}`);
}

export interface SegmentHeader {
    presentationTimestamp: number;
    decodingTimestamp: number;
    segmentType: SegmentType;
    segmentSize: number;
}

export interface Segment {
    readonly header: SegmentHeader;
}

export interface PresentationCompositionSegment extends Segment {
    readonly width: number;
    readonly height: number;
    readonly compositionNumber: number;
    readonly compositionState: CompositionState;
    readonly paletteUpdateFlag: boolean;
    readonly paletteId: number;
    readonly compositionObjectCount: number;
    readonly objectId: number;
    readonly windowId: number;
    readonly objectCroppedFlag: boolean;
    readonly objectHorizontalPosition: number;
    readonly objectVerticalPosition: number;
    readonly objectCroppingHorizontalPosition: number;
    readonly objectCroppingVerticalPosition: number;
    readonly objectCroppingWidth: number;
    readonly objectCroppingHeightPosition: number;
}

export interface WindowDefinition {
    readonly windowId: number;
    readonly windowHorizontalPosition: number;
    readonly windowVerticalPosition: number;
    readonly windowWidth: number;
    readonly windowHeight: number;
}

export interface WindowDefinitionSegment extends Segment {
    readonly windowCount: number;
    readonly windowDefinitions: WindowDefinition[];
}

export interface PaletteEntry {
    readonly paletteEntryId: number;
    readonly luminance: number;
    readonly colorDifferenceRed: number;
    readonly colorDifferenceBlue: number;
    readonly transparency: number;
}

export interface PaletteDefinitionSegment extends Segment {
    readonly paletteId: number;
    readonly paletteVersionNumber: number;
    readonly paletteEntries: PaletteEntry[];
}

export interface ObjectDefinitionSegment extends Segment {
    readonly objectId: number;
    readonly objectVersionNumber: number;
    readonly lastInSequenceFlag: LastInSequenceFlag;
    readonly objectDataLength: number;
    readonly width?: number;
    readonly height?: number;
    readonly objectData: BufferAdapter;
}
