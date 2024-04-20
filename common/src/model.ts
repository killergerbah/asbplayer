import { AnkiSettings } from '../settings/settings';

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

export interface CardTextFieldValues {
    readonly word?: string;
    readonly definition?: string;
    readonly text?: string;
    readonly customFieldValues?: { [fieldName: string]: string };
}

export interface CardModel extends CardTextFieldValues {
    readonly id?: string;
    readonly subtitle: SubtitleModel;
    readonly surroundingSubtitles: SubtitleModel[];
    readonly subtitleFileName: string;
    readonly url?: string;
    readonly image?: ImageModel;
    readonly audio?: AudioModel;
    readonly file?: FileModel;
    readonly mediaTimestamp: number;
}

export interface FileModel {
    readonly name: string;
    readonly blobUrl: string;
    readonly playbackRate?: number;
    readonly audioTrack?: string;
}

export interface CopyHistoryItem extends CardModel {
    readonly id: string;
    readonly timestamp: number;
}

export interface ImageModel {
    readonly base64: string;
    readonly extension: 'jpeg';
}

export enum AudioErrorCode {
    drmProtected = 1,
    fileLinkLost = 2,
}

export interface AudioModel {
    readonly base64: string;
    readonly extension: 'webm' | 'mp3';
    readonly paddingStart: number;
    readonly paddingEnd: number;
    readonly start?: number;
    readonly end?: number;
    readonly playbackRate?: number;
    readonly error?: AudioErrorCode;
}

export interface AnkiUiState extends CardTextFieldValues {
    readonly type: 'initial' | 'resume';
    readonly open: boolean;
    readonly canRerecord: boolean;
    readonly settingsProvider: AnkiSettings;
    readonly subtitle: SubtitleModel;
    readonly surroundingSubtitles: SubtitleModel[];
    readonly url?: string;
    readonly source: string;
    readonly image?: ImageModel;
    readonly audio?: AudioModel;
    readonly file?: FileModel;
    readonly themeType: string;
    readonly dialogRequestedTimestamp: number;
}

export interface AnkiUiInitialState extends AnkiUiState {
    readonly type: 'initial';
}

export interface AnkiUiResumeState extends AnkiUiState {
    readonly type: 'resume';
    readonly text: string;
    readonly initialTimestampInterval: number[];
    readonly timestampInterval: number[];
    readonly timestampBoundaryInterval?: number[];
    readonly definition: string;
    readonly word: string;
    readonly customFieldValues: { [key: string]: string };
    readonly lastAppliedTimestampIntervalToText: number[];
    readonly lastAppliedTimestampIntervalToAudio?: number[];
}

export interface AnkiUiSavedState {
    subtitle: SubtitleModel;
    surroundingSubtitles: SubtitleModel[];
    text: string;
    definition: string;
    image?: ImageModel;
    audio?: AudioModel;
    file?: FileModel;
    word: string;
    source: string;
    url: string;
    customFieldValues: { [key: string]: string };
    timestampInterval: number[];
    initialTimestampInterval: number[];
    timestampBoundaryInterval?: number[];
    lastAppliedTimestampIntervalToText: number[];
    lastAppliedTimestampIntervalToAudio?: number[];
    dialogRequestedTimestamp: number;
}

export interface VideoDataSubtitleTrack {
    label: string;
    language: string;
    url: string;
    m3U8BaseUrl?: string;
    extension: string;
}

export interface ConfirmedVideoDataSubtitleTrack {
    name: string;
    language: string;
    subtitleUrl: string;
    m3U8BaseUrl?: string;
    extension: string;
}

export interface VideoData {
    basename: string;
    error?: string;
    subtitles?: VideoDataSubtitleTrack[];
}

export interface VideoDataUiState {
    open?: boolean;
    isLoading?: boolean;
    suggestedName?: string;
    subtitles?: VideoDataSubtitleTrack[];
    error?: string;
    themeType?: string;
    selectedSubtitle?: string[];
    showSubSelect?: boolean;
    openedFromMiningCommand?: boolean;
    defaultCheckboxState?: boolean;
}

export interface VideoTabModel {
    id: number; // Actually the tab ID
    title?: string;
    src: string; // Video src
    subscribed: boolean; // Whether the video element is subscribed to extension messages
    synced: boolean; // Whether the video element has received subtitles
    syncedTimestamp?: number;
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

export enum PostMineAction {
    none = 0,
    showAnkiDialog = 1,
    updateLastCard = 2,
    exportCard = 3,
}

export enum AutoPausePreference {
    atStart = 1,
    atEnd = 2,
}

export enum PlayMode {
    normal = 1,
    condensed = 2,
    autoPause = 3,
    fastForward = 4,
    repeat = 5,
}

export interface MobileOverlayModel {
    offset: number;
    emptySubtitleTrack: boolean;
    recordingEnabled: boolean;
    recording: boolean;
    previousSubtitleTimestamp?: number;
    nextSubtitleTimestamp?: number;
    currentTimestamp: number;
    language: string;
    postMineAction: PostMineAction;
    subtitleDisplaying: boolean;
}
