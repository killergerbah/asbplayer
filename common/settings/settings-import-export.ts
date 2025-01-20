import { Validator } from 'jsonschema';

const keyBindSchema = {
    id: '/KeyBind',
    type: 'object',
    properties: {
        keys: {
            type: 'string',
        },
    },
    required: ['keys'],
};
const ankiFieldSchema = {
    id: '/AnkiField',
    type: 'object',
    properties: {
        order: {
            type: 'number',
        },
        display: {
            type: 'boolean',
        },
    },
    required: ['order', 'display'],
};
const textSubtitleSettingsSchema = {
    id: '/TextSubtitleSettings',
    type: 'object',
    properties: {
        subtitleColor: {
            type: 'string',
        },
        subtitleSize: {
            type: 'number',
        },
        subtitleThickness: {
            type: 'number',
        },
        subtitleOutlineThickness: {
            type: 'number',
        },
        subtitleShadowColor: {
            type: 'string',
        },
        subtitleBackgroundOpacity: {
            type: 'number',
        },
        subtitleBackgroundColor: {
            type: 'string',
        },
        subtitleFontFamily: {
            type: 'string',
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
        subtitleBlur: {
            type: 'boolean',
        },
    },
    required: [
        'subtitleColor',
        'subtitleSize',
        'subtitleThickness',
        'subtitleOutlineThickness',
        'subtitleShadowColor',
        'subtitleBackgroundOpacity',
        'subtitleBackgroundColor',
        'subtitleFontFamily',
        'subtitleCustomStyles',
        'subtitleBlur',
    ],
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
        track1Field: {
            type: 'string',
        },
        track2Field: {
            type: 'string',
        },
        track3Field: {
            type: 'string',
        },
        ankiFieldSettings: {
            type: 'object',
            properties: {
                sentence: { $ref: '/AnkiField' },
                definition: { $ref: '/AnkiField' },
                audio: { $ref: '/AnkiField' },
                image: { $ref: '/AnkiField' },
                word: { $ref: '/AnkiField' },
                source: { $ref: '/AnkiField' },
                url: { $ref: '/AnkiField' },
                track1: { $ref: '/AnkiField' },
                track2: { $ref: '/AnkiField' },
                track3: { $ref: '/AnkiField' },
            },
        },
        customAnkiFieldSettings: {
            type: 'object',
            additionalProperties: {
                type: '/AnkiField',
            },
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
        subtitleShadowThickness: {
            type: 'number',
        },
        subtitleShadowColor: {
            type: 'string',
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
        subtitleBlur: {
            type: 'boolean',
        },
        subtitlePreview: {
            type: 'string',
        },
        subtitlePositionOffset: {
            type: 'number',
        },
        topSubtitlePositionOffset: {
            type: 'number',
        },
        subtitleAlignment: {
            type: 'string',
        },
        subtitleTracksV2: {
            type: 'array',
            items: {
                $ref: '/TextSubtitleSettings',
            },
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
        speedChangeStep: {
            type: 'number',
        },
        fastForwardModePlaybackRate: {
            type: 'number',
        },
        keyBindSet: {
            type: 'object',
            properties: {
                togglePlay: { $ref: '/KeyBind' },
                toggleAutoPause: { $ref: '/KeyBind' },
                toggleCondensedPlayback: { $ref: '/KeyBind' },
                toggleFastForwardPlayback: { $ref: '/KeyBind' },
                toggleSubtitles: { $ref: '/KeyBind' },
                toggleVideoSubtitleTrack1: { $ref: '/KeyBind' },
                toggleVideoSubtitleTrack2: { $ref: '/KeyBind' },
                toggleVideoSubtitleTrack3: { $ref: '/KeyBind' },
                toggleAsbplayerSubtitleTrack1: { $ref: '/KeyBind' },
                toggleAsbplayerSubtitleTrack2: { $ref: '/KeyBind' },
                toggleAsbplayerSubtitleTrack3: { $ref: '/KeyBind' },
                unblurAsbplayerTrack1: { $ref: '/KeyBind' },
                unblurAsbplayerTrack2: { $ref: '/KeyBind' },
                unblurAsbplayerTrack3: { $ref: '/KeyBind' },
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
                toggleRecording: { $ref: '/KeyBind' },
                decreasePlaybackRate: { $ref: '/KeyBind' },
                increasePlaybackRate: { $ref: '/KeyBind' },
                toggleSidePanel: { $ref: '/KeyBind' },
                toggleRepeat: { $ref: '/KeyBind' },
            },
        },
        recordWithAudioPlayback: {
            type: 'boolean',
        },
        preferMp3: {
            type: 'boolean',
        },
        tabName: {
            type: 'string',
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
        postMiningPlaybackState: {
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
        lastSubtitleOffset: {
            type: 'number',
        },
        autoCopyCurrentSubtitle: {
            type: 'boolean',
        },
        alwaysPlayOnSubtitleRepeat: {
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
        subtitlesWidth: {
            type: 'number',
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
                type: 'array',
                items: {
                    type: 'string',
                },
            },
        },
        streamingCondensedPlaybackMinimumSkipIntervalMs: {
            type: 'number',
        },
        streamingScreenshotDelay: {
            type: 'number',
        },
        streamingSubtitleListPreference: {
            type: 'string',
        },
        streamingEnableOverlay: {
            type: 'boolean',
        },
        webSocketClientEnabled: {
            type: 'boolean',
        },
        webSocketServerUrl: {
            type: 'string',
        },
        pauseOnHoverMode: {
            type: 'number',
        },
        lastSelectedAnkiExportMode: {
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
    validator.addSchema(ankiFieldSchema);
    validator.addSchema(textSubtitleSettingsSchema);
    const result = validator.validate(settings, settingsSchema);
    validateAllKnownKeys(settings, []);

    if (!result.valid) {
        throw new Error('Settings validation failed: ' + JSON.stringify(result.errors));
    }
};

const validateAllKnownKeys = (object: any, path: string[]) => {
    for (const key of Object.keys(object)) {
        const schema = schemaAtPath(settingsSchema, path);

        // Empty string is sentinel value for 'additional properties' which can have any key
        if (schema === undefined || (schema !== '' && !(key in schema))) {
            throw new Error(`Unknown key '${[...path, key].join('.')}'`);
        }

        const value = object[key];

        if (typeof value === 'object' && !Array.isArray(value)) {
            validateAllKnownKeys(value, [...path, key]);
        }
    }
};

const schemaAtPath = (schema: any, path: string[]) => {
    let value = schema['properties'];

    for (const key of path) {
        if (typeof value[key] === 'object' && 'additionalProperties' in value[key]) {
            return '';
        }

        value = value[key]?.['properties'] ?? schemaForRef(value[key]?.['$ref'])?.['properties'];

        if (value === undefined) {
            return undefined;
        }
    }

    return value;
};

const schemaForRef = (ref: string) => {
    if (ref === '/KeyBind') {
        return keyBindSchema;
    }

    if (ref === '/AnkiField') {
        return ankiFieldSchema;
    }

    if (ref === '/TextSubtitleSettings') {
        return textSubtitleSettingsSchema;
    }

    return undefined;
};
