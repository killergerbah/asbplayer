export type WhisperOptionValue = string | number | boolean | null;

/** The subtitle source used by a generation job. Omit this for legacy Whisper jobs. */
export type SubtitleGenerator = 'whisper' | 'ocr';

export type OcrLanguage = 'ch' | 'chinese_cht';
export type OcrQuality = 'medium' | 'small';

export interface OcrOptions {
    readonly language: OcrLanguage;
    readonly quality: OcrQuality;
}

export interface OcrCapabilities {
    readonly available: boolean;
    readonly error?: string;
    readonly qualities: readonly OcrQuality[];
    readonly languages: readonly OcrLanguage[];
    readonly defaultQuality: OcrQuality;
}

export interface WhisperOptionSchema {
    readonly name: string;
    readonly label: string;
    readonly description?: string;
    readonly group: string;
    readonly type: 'string' | 'number' | 'boolean';
    readonly defaultValue: WhisperOptionValue;
    readonly choices?: readonly (string | number)[];
    /** Runtime options do not change the cached subtitle output. */
    readonly affectsOutput: boolean;
}

export interface WhisperCapabilities {
    readonly whisperVersion: string;
    readonly options: WhisperOptionSchema[];
    /** Absent when communicating with a pre-OCR subtitle service. */
    readonly ocr?: OcrCapabilities;
}

export type SubtitleGenerationJobState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'queued'
    | 'downloading'
    | 'loading-model'
    | 'transcribing'
    | 'analyzing-video'
    | 'recognizing-text'
    | 'completed'
    | 'failed'
    | 'cancelled';

export interface GeneratedSubtitleCacheEntry {
    readonly id: string;
    readonly label: string;
    readonly fileName: string;
    readonly createdAt: string;
    readonly sourceKey: string;
}

export interface SubtitleGenerationJob {
    readonly id: string;
    readonly state: SubtitleGenerationJobState;
    readonly generator?: SubtitleGenerator;
    readonly progress?: number;
    /** Native Whisper model-download counter, such as `380M`. */
    readonly modelDownloaded?: string;
    /** Native Whisper model-download total, such as `1.48G`. */
    readonly modelTotal?: string;
    /** Native Whisper tqdm frame counter. */
    readonly completedFrames?: number;
    /** Native Whisper tqdm frame counter total. */
    readonly totalFrames?: number;
    readonly remainingSeconds?: number;
    readonly error?: string;
    readonly entry?: GeneratedSubtitleCacheEntry;
}

export interface SubtitleGenerationUiState {
    readonly sourceUrl?: string;
    readonly state: SubtitleGenerationJobState;
    readonly generator?: SubtitleGenerator;
    readonly capabilities?: WhisperCapabilities;
    readonly job?: SubtitleGenerationJob;
    readonly error?: string;
}
