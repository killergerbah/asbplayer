import {
    isWebmMediaFragmentSupported,
    minWebmMediaFragmentDurationMs,
    preferredWebmMediaFragmentMimeType,
    resolveWebmMediaFragmentRange,
} from './media-fragment';

const originalMediaRecorder = (globalThis as any).MediaRecorder;
const originalCaptureStream = (HTMLCanvasElement.prototype as any).captureStream;

afterEach(() => {
    (globalThis as any).MediaRecorder = originalMediaRecorder;
    (HTMLCanvasElement.prototype as any).captureStream = originalCaptureStream;
});

it('resolves WebM range with minimum duration when trims collapse the interval', () => {
    const { startTimestamp, endTimestamp } = resolveWebmMediaFragmentRange(1_000, 2_000, 800, 500);

    expect(startTimestamp).toEqual(1_800);
    expect(endTimestamp).toEqual(1_800 + minWebmMediaFragmentDurationMs);
});

it('resolves WebM range with negative trims by expanding capture range', () => {
    const { startTimestamp, endTimestamp } = resolveWebmMediaFragmentRange(1_000, 2_000, -200, -300);

    expect(startTimestamp).toEqual(800);
    expect(endTimestamp).toEqual(2_300);
});

it('resolves WebM range with non-finite trims by treating them as zero', () => {
    const { startTimestamp, endTimestamp } = resolveWebmMediaFragmentRange(1_000, 2_000, Number.NaN, Number.NaN);

    expect(startTimestamp).toEqual(1_000);
    expect(endTimestamp).toEqual(2_000);
});

it('returns false for WebM support when MediaRecorder is unavailable', () => {
    (globalThis as any).MediaRecorder = undefined;
    (HTMLCanvasElement.prototype as any).captureStream = () => undefined;

    expect(isWebmMediaFragmentSupported()).toEqual(false);
});

it('prefers AV1 over VP9 and VP8 when available', () => {
    const supported = new Set(['video/webm;codecs=av1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8']);
    const mediaRecorder: any = function () {};
    mediaRecorder.isTypeSupported = (mimeType: string) => supported.has(mimeType);

    (globalThis as any).MediaRecorder = mediaRecorder;

    expect(preferredWebmMediaFragmentMimeType()).toEqual('video/webm;codecs=av1');
});

it('falls back to generic WebM when codec probing is unavailable', () => {
    const mediaRecorder: any = function () {};
    mediaRecorder.isTypeSupported = undefined;

    (globalThis as any).MediaRecorder = mediaRecorder;

    expect(preferredWebmMediaFragmentMimeType()).toEqual('video/webm');
});

it('returns true for WebM support when MediaRecorder and captureStream are available', () => {
    const mediaRecorder: any = function () {};
    mediaRecorder.isTypeSupported = (mimeType: string) => mimeType === 'video/webm';

    (globalThis as any).MediaRecorder = mediaRecorder;
    (HTMLCanvasElement.prototype as any).captureStream = () => undefined;

    expect(isWebmMediaFragmentSupported()).toEqual(true);
});
