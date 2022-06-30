import { AnkiSettings } from './Settings';

export interface RectModel {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}

export interface DimensionsModel {
    readonly width: number;
    readonly height: number;
}

export interface SubtitleTextImage {
    readonly dataUrl: string;
    readonly screen: DimensionsModel;
    readonly image: DimensionsModel;
}

export interface SubtitleModel {
    readonly text: string;
    readonly textImage?: SubtitleTextImage;
    readonly start: number;
    readonly end: number;
    readonly originalStart: number;
    readonly originalEnd: number;
    readonly track: number;
}

export interface CopiedSubtitleModel extends SubtitleModel {
    surroundingSubtitles: SubtitleModel[];
    timestamp: number;
    id: string;
    name: string;
    subtitleFile?: File;
    audioFile?: File;
    videoFile?: File;
    audioTrack?: number;
    audio?: AudioModel;
    image?: ImageModel;
}

export interface ImageModel {
    readonly base64: string;
    readonly extension: 'jpeg';
}

export interface AudioModel {
    readonly base64: string;
    readonly extension: 'webm' | 'mp3';
    readonly paddingStart: number;
    readonly paddingEnd: number;
    readonly start?: number;
    readonly end?: number;
}

export interface AnkiDialogSliderContext {
    subtitleStart: number;
    subtitleEnd: number;
    subtitles: SubtitleModel[];
}

export interface AnkiUiState {
    readonly type: 'initial' | 'resume';
    readonly open: boolean;
    readonly settingsProvider: AnkiSettings;
    readonly subtitle: SubtitleModel;
    readonly url: string;
    readonly source: string;
    readonly image?: ImageModel;
    readonly audio?: AudioModel;
    readonly themeType: string;
}

export interface AnkiUiInitialState extends AnkiUiState {
    readonly type: 'initial';
    readonly surroundingSubtitles: SubtitleModel[];
}

export interface AnkiUiResumeState extends AnkiUiState {
    readonly type: 'resume';

    readonly text: string;
    readonly timestampInterval: number[];
    readonly sliderContext: AnkiDialogSliderContext;
    readonly definition: string;
    readonly word: string;
    readonly customFieldValues: { [key: string]: string };
    readonly lastAppliedTimestampIntervalToText: number[];
    readonly lastAppliedTimestampIntervalToAudio?: number[];
}

export interface AnkiUiRerecordState {
    subtitle: SubtitleModel;
    text: string;
    sliderContext: AnkiDialogSliderContext;
    definition: string;
    image?: ImageModel;
    audio?: AudioModel;
    word: string;
    source: string;
    url: string;
    customFieldValues: { [key: string]: string };
    timestampInterval: number[];
    lastAppliedTimestampIntervalToText: number[];
    lastAppliedTimestampIntervalToAudio?: number[];
}

export interface VideoDataSubtitleTrack {
    label: string;
    language: string;
    url: string;
}

export interface ConfirmedVideoDataSubtitleTrack {
    name: string;
    language: string;
    subtitleUrl: string;
}

export interface VideoData {
    basename: string;
    error?: string;
    subtitles: VideoDataSubtitleTrack[];
    extension: string;
}

export interface VideoDataUiState {
    open?: boolean;
    isLoading?: boolean;
    suggestedName?: string;
    subtitles?: VideoDataSubtitleTrack[];
    error?: string;
    themeType?: string;
    selectedSubtitle?: string;
    showSubSelect?: boolean;
}

export interface VideoTabModel {
    id: number; // Actually the tab ID
    title?: string;
    src: string; // Video src
}

export interface Rgb {
    r: number;
    g: number;
    b: number;
}

export interface AudioTrackModel {
    id: string;
    label: string;
    language: string;
}
