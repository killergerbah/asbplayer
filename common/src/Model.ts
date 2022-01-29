import { AnkiSettings } from './Settings';

export interface RectModel {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}

export interface SubtitleModel {
    readonly text: string;
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
    readonly start: number;
    readonly end: number;
}

export interface AnkiDialogSliderContext {
    subtitleStart: number;
    subtitleEnd: number;
    subtitles: SubtitleModel[];
}

export interface AnkiUiState {
    readonly type: 'initial' | 'resume';
    readonly open: boolean;
    readonly id: string;
    readonly settingsProvider: AnkiSettings;
    readonly source: string;
    readonly subtitle: SubtitleModel;
    readonly surroundingSubtitles: [SubtitleModel];
    readonly image?: ImageModel;
    readonly audio?: AudioModel;
    readonly themeType: string;
}

export interface AnkiUiDialogState {
    readonly subtitle: SubtitleModel;
    readonly text: string;
    readonly sliderContext: AnkiDialogSliderContext;
    readonly definition: string;
    readonly image?: ImageModel;
    readonly audio?: AudioModel;
    readonly word: string;
    readonly source: string;
    readonly customFieldValues: { [key: string]: string };
    readonly timestampInterval: number[];
    readonly lastAppliedTimestampIntervalToText: number[];
}

export interface AnkiUiContainerCurrentItem {
    readonly subtitle: SubtitleModel;
    readonly surroundingSubtitles: SubtitleModel[];
    image?: ImageModel;
    audio?: AudioModel;
    url?: string;
    id: string;
}
