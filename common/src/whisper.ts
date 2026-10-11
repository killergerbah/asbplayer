export type WhisperOptionValue = string | number | boolean | null;

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
}

export type SubtitleGenerationJobState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'queued'
    | 'downloading'
    | 'loading-model'
    | 'transcribing'
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
    readonly capabilities?: WhisperCapabilities;
    readonly job?: SubtitleGenerationJob;
    readonly error?: string;
}
