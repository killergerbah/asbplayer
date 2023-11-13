import { SettingsProvider } from './settings-provider';
import { Validator } from 'jsonschema';
import { download } from './util';
import { AsbplayerSettings } from './settings';

const keyBindSchema = {
    id: '/KeyBind',
    type: 'object',
    properties: {
        keys: {
            type: 'string',
        },
    },
};
const settingsSchema = {
    id: '/Settings',
    type: 'object',
    properties: {
        ankiConnectUrl: {
            type: 'string',
        },
        deck: {
            type: 'string',
        },
        noteType: {
            type: 'string',
        },
        sentenceField: {
            type: 'string',
        },
        definitionField: {
            type: 'string',
        },
        audioField: {
            type: 'string',
        },
        imageField: {
            type: 'string',
        },
        wordField: {
            type: 'string',
        },
        sourceField: {
            type: 'string',
        },
        urlField: {
            type: 'string',
        },
        subtitleSize: {
            type: 'number',
        },
        subtitleColor: {
            type: 'string',
        },
        subtitleThickness: {
            type: 'number',
        },
        subtitleOutlineThickness: {
            type: 'number',
        },
        subtitleOutlineColor: {
            type: 'string',
        },
        subtitleBackgroundColor: {
            type: 'string',
        },
        subtitleBackgroundOpacity: {
            type: 'number',
        },
        subtitleFontFamily: {
            type: 'string',
        },
        subtitlePreview: {
            type: 'string',
        },
        audioPaddingStart: {
            type: 'number',
        },
        audioPaddingEnd: {
            type: 'number',
        },
        maxImageWidth: {
            type: 'number',
        },
        maxImageHeight: {
            type: 'number',
        },
        surroundingSubtitlesCountRadius: {
            type: 'number',
        },
        surroundingSubtitlesTimeRadius: {
            type: 'number',
        },
        autoPausePreference: {
            type: 'number',
        },
        keyBindSet: {
            type: 'object',
            properties: {
                togglePlay: { $ref: '/KeyBind' },
                toggleAutoPause: { $ref: '/KeyBind' },
                toggleCondensedPlayback: { $ref: '/KeyBind' },
                toggleSubtitles: { $ref: '/KeyBind' },
                toggleVideoSubtitleTrack1: { $ref: '/KeyBind' },
                toggleVideoSubtitleTrack2: { $ref: '/KeyBind' },
                toggleAsbplayerSubtitleTrack1: { $ref: '/KeyBind' },
                toggleAsbplayerSubtitleTrack2: { $ref: '/KeyBind' },
                seekBackward: { $ref: '/KeyBind' },
                seekForward: { $ref: '/KeyBind' },
                seekToPreviousSubtitle: { $ref: '/KeyBind' },
                seekToNextSubtitle: { $ref: '/KeyBind' },
                seekToBeginningOfCurrentSubtitle: { $ref: '/KeyBind' },
                adjustOffsetToPreviousSubtitle: { $ref: '/KeyBind' },
                adjustOffsetToNextSubtitle: { $ref: '/KeyBind' },
                decreaseOffset: { $ref: '/KeyBind' },
                increaseOffset: { $ref: '/KeyBind' },
                resetOffset: { $ref: '/KeyBind' },
                copySubtitle: { $ref: '/KeyBind' },
                ankiExport: { $ref: '/KeyBind' },
                updateLastCard: { $ref: '/KeyBind' },
                takeScreenshot: { $ref: '/KeyBind' },
                decreasePlaybackRate: { $ref: '/KeyBind' },
                increasePlaybackRate: { $ref: '/KeyBind' },
                toggleSidePanel: { $ref: '/KeyBind' },
            },
        },
        preferMp3: {
            type: 'boolean',
        },
        miningHistoryStorageLimit: {
            type: 'number',
        },
        preCacheSubtitleDom: {
            type: 'boolean',
        },
        clickToMineDefaultAction: {
            type: 'number',
        },
        themeType: {
            type: 'string',
        },
        copyToClipboardOnMine: {
            type: 'boolean',
        },
        rememberSubtitleOffset: {
            type: 'boolean',
        },
        autoCopyCurrentSubtitle: {
            type: 'boolean',
        },
        subtitleRegexFilter: {
            type: 'string',
        },
        subtitleRegexFilterTextReplacement: {
            type: 'string',
        },
        language: {
            type: 'string',
        },
        customAnkiFields: {
            type: 'object',
            additionalProperties: {
                type: 'string',
            },
        },
        tags: {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        imageBasedSubtitleScaleFactor: {
            type: 'number',
        },
        subtitleCustomStyles: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    key: {
                        type: 'string',
                    },
                    value: {
                        type: 'string',
                    },
                },
            },
        },
        streamingAppUrl: {
            type: 'string',
        },
        streamingDisplaySubtitles: {
            type: 'boolean',
        },
        streamingRecordMedia: {
            type: 'boolean',
        },
        streamingTakeScreenshot: {
            type: 'boolean',
        },
        streamingCleanScreenshot: {
            type: 'boolean',
        },
        streamingCropScreenshot: {
            type: 'boolean',
        },
        streamingSubsDragAndDrop: {
            type: 'boolean',
        },
        streamingAutoSync: {
            type: 'boolean',
        },
        streamingLastLanguagesSynced: {
            type: 'object',
            additionalProperties: {
                type: 'string',
            },
        },
        streamingCondensedPlaybackMinimumSkipIntervalMs: {
            type: 'number',
        },
        streamingSubtitlePositionOffset: {
            type: 'number',
        },
        streamingScreenshotDelay: {
            type: 'number',
        },
        streamingSubtitleAlignment: {
            type: 'string',
        },
        streamingSubtitleListPreference: {
            type: 'string',
        },
        _schema: {
            type: 'number',
        },
    },
};

export const validateSettings = (settings: any) => {
    const validator = new Validator();
    validator.addSchema(keyBindSchema);
    const result = validator.validate(settings, settingsSchema);

    if (!result.valid) {
        throw new Error('Settings validation failed');
    }
};

export const exportSettings = async (settings: AsbplayerSettings) => {
    download(new Blob([JSON.stringify(settings)], { type: 'appliction/json' }), 'asbplayer-settings.json');
};
