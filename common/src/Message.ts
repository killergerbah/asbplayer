import { AnkiSettings, MiscSettings, SubtitleSettings } from '.';
import {
    RectModel,
    SubtitleModel,
    ImageModel,
    AudioModel,
    AnkiUiDialogState,
    AnkiUiContainerCurrentItem,
    AudioTrackModel,
} from './Model';

export interface Message {
    readonly command: string;
}

export interface ActiveVideoElement {
    id: number;
    title?: string;
    src: string;
}

export interface AsbplayerHeartbeatMessage extends Message {
    readonly command: 'heartbeat';
    readonly id: string;
    readonly receivedTabs?: ActiveVideoElement[];
}

export interface VideoHeartbeatMessage extends Message {
    readonly command: 'heartbeat';
}

export interface HttpPostMessage extends Message {
    readonly command: 'http-post';
    readonly url: string;
    readonly body: any;
}

export interface SettingsUpdatedMessage extends Message {
    readonly command: 'settings-updated';
}

export interface RecordMediaAndForwardSubtitleMessage extends Message {
    readonly command: 'record-media-and-forward-subtitle';
    readonly subtitle: SubtitleModel;
    readonly surroundingSubtitles: SubtitleModel[];
    readonly url?: string;
    readonly record: boolean;
    readonly screenshot: boolean;
    readonly showAnkiUi: boolean;
    readonly audioPaddingStart: number;
    readonly audioPaddingEnd: number;
    readonly playbackRate: number;
    readonly rect?: RectModel;
    readonly maxImageWidth: number;
    readonly maxImageHeight: number;
}

export interface StartRecordingMediaMessage extends Message {
    readonly command: 'start-recording-media';
    readonly record: boolean;
    readonly timestamp: number;
    readonly screenshot: boolean;
    readonly showAnkiUi: boolean;
    readonly rect?: RectModel;
    readonly maxImageWidth: number;
    readonly maxImageHeight: number;
    readonly url?: string;
}

export interface StopRecordingMediaMessage extends Message {
    readonly command: 'stop-recording-media';
    readonly showAnkiUi: boolean;
    readonly startTimestamp: number;
    readonly endTimestamp: number;
    readonly screenshot: boolean;
    readonly videoDuration: number;
    readonly url?: string;
}

export interface CopyMessage extends Message {
    readonly command: 'copy';
    readonly id: string;
    readonly subtitle: SubtitleModel;
    readonly surroundingSubtitles: SubtitleModel[];
    readonly url?: string;
    readonly image?: ImageModel;
    readonly audio?: AudioModel;
    readonly preventDuplicate?: boolean;
}

export interface ScreenshotTakenMessage extends Message {
    readonly command: 'screenshot-taken';
}

export interface ShowAnkiUiMessage extends Message {
    readonly command: 'show-anki-ui';
    readonly id: string;
    readonly subtitle: SubtitleModel;
    readonly surroundingSubtitles: SubtitleModel[];
    readonly url?: string;
    readonly image?: ImageModel;
    readonly audio?: AudioModel;
}

export interface RerecordMediaMessage extends Message {
    readonly command: 'rerecord-media';
    readonly duration: number;
    readonly uiState: AnkiUiDialogState;
    readonly audioPaddingStart: number;
    readonly audioPaddingEnd: number;
    readonly currentItem: AnkiUiContainerCurrentItem;
    readonly playbackRate: number;
    readonly timestamp: number;
}

export interface ShowAnkiUiAfterRerecordMessage extends Message {
    command: 'show-anki-ui-after-rerecord';
    id: string;
    uiState: AnkiUiDialogState;
    audio: AudioModel;
}

export interface PlayerSyncMessage extends Message {
    command: 'syncv2';
    subtitles: SubtitleModel[];
}

export interface ExtensionSyncMessage extends Message {
    command: 'sync';
    subtitles: SubtitleModel[];
}

export interface OffsetFromVideoMessage extends Message {
    command: 'offset';
    value: number;
}

export interface ToggleSubtitlesMessage extends Message {
    command: 'toggle-subtitles';
}

export interface ToggleSubtitlesInListFromVideoMessage extends Message {
    command: 'toggleSubtitleTrackInList';
    track: number;
}

export interface ReadyStateFromVideoMessage extends Message {
    command: 'readyState';
    value: number;
}

export interface ReadyFromVideoMessage extends Message {
    command: 'ready';
    duration: number;
    currentTime: number;
    paused: boolean;
    audioTracks?: AudioTrackModel[];
    selectedAudioTrack?: string;
    playbackRate: number;
}

export interface ReadyToVideoMessage extends Message {
    command: 'ready';
    duration: number;
}

export interface PlayFromVideoMessage extends Message {
    command: 'play';
    echo: boolean;
}

export interface PauseFromVideoMessage extends Message {
    command: 'pause';
    echo: boolean;
}

export interface CurrentTimeFromVideoMessage extends Message {
    command: 'currentTime';
    value: number;
    echo: boolean;
}

export interface PlaybackRateFromVideoMessage extends Message {
    command: 'playbackRate';
    value: number;
    echo: boolean;
}

export interface AudioTrackSelectedFromVideoMessage extends Message {
    readonly command: 'audioTrackSelected';
    readonly id: string;
}

export interface AudioTrackSelectedToVideoMessage extends Message {
    readonly command: 'audioTrackSelected';
    readonly id: string;
}

export interface AnkiDialogRequestFromVideoMessage extends Message {
    readonly command: 'ankiDialogRequest';
    readonly forwardToVideo: boolean;
}

export interface ToggleSubtitleTrackInListFromVideoMessage extends Message {
    readonly command: 'toggleSubtitleTrackInList';
    readonly track: number;
}

export interface SubtitlesToVideoMessage extends Message {
    command: 'subtitles';
    value: SubtitleModel[];
    name?: string;
    names: string[];
}

export interface SubtitleSettingsToVideoMessage extends Message {
    command: 'subtitleSettings';
    value: SubtitleSettings;
}

export interface CondensedModeToggleToVideoMessage extends Message {
    command: 'condensedModeToggle';
    value: boolean;
}

export interface HideSubtitlePlayerToggleToVideoMessage extends Message {
    command: 'hideSubtitlePlayerToggle';
    value: boolean;
}

export interface FinishedAnkiDialogRequestToVideoMessage extends Message {
    command: 'finishedAnkiDialogRequest';
    resume: boolean;
}

export interface AnkiSettingsToVideoMessage extends Message {
    command: 'ankiSettings';
    value: AnkiSettings;
}

export interface MiscSettingsToVideoMessage extends Message {
    command: 'miscSettings';
    value: MiscSettings;
}
