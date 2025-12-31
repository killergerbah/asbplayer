import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import LabelWithHoverEffect from './LabelWithHoverEffect';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
    Autocomplete,
    Button,
    Checkbox,
    FormControl,
    FormLabel,
    IconButton,
    InputAdornment,
    Link,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Radio,
    RadioGroup,
    Stack,
    Switch,
    Typography,
} from '@mui/material';
import MuiAlert, { type AlertProps } from '@mui/material/Alert';
import {
    AsbplayerSettings,
    TokenMatchStrategy,
    TokenMatchStrategyPriority,
    TokenReadingAnnotation,
    TokenStyling,
    getFullyKnownTokenStatus,
    NUM_DICTIONARY_TRACKS,
    NUM_TOKEN_STATUSES,
    compareDTField,
} from '@project/common/settings';
import { Anki } from '../anki';
import { Yomitan } from '../yomitan/yomitan';
import SwitchLabelWithHoverEffect from './SwitchLabelWithHoverEffect';
import SettingsTextField from './SettingsTextField';
import SettingsSection from './SettingsSection';
import { DictionaryBuildAnkiCacheState } from '../src/message';
import { DictionaryProvider } from '../dictionary-db';

const Alert: React.FC<AlertProps> = ({ children, ...props }) => {
    return (
        <MuiAlert
            style={{
                // SettingsDialog applies height: 100vh to .MuiPaper-root - override it here
                height: 'auto',
            }}
            {...props}
        >
            {children}
        </MuiAlert>
    );
};

const command = 'dictionary-build-anki-cache-state';

interface Props {
    settings: AsbplayerSettings;
    dictionaryProvider: DictionaryProvider;
    extensionInstalled: boolean;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
    activeProfile?: string;
    anki: Anki;
}

const DictionarySettingsTab: React.FC<Props> = ({
    dictionaryProvider,
    settings,
    extensionInstalled,
    onSettingChanged,
    activeProfile,
    anki,
}) => {
    const { t } = useTranslation();
    const { ankiConnectUrl, dictionaryTracks } = settings;
    const initialDictionaryTracksRef = useRef(dictionaryTracks);
    const [selectedDictionaryTrack, setSelectedDictionaryTrack] = useState<number>(0);
    const selectedDictionary = dictionaryTracks[selectedDictionaryTrack];

    const getHelperTextForAnkiCacheSettingsDependencies = useCallback(
        (fieldName: string, key: keyof typeof selectedDictionary, error?: string) => {
            if (error) return error;
            const initialTrack = initialDictionaryTracksRef.current[selectedDictionaryTrack];
            if (compareDTField(key, initialTrack, selectedDictionary)) return;
            return t('settings.ankiCacheDependentSettingsHelperText', { field: fieldName });
        },
        [selectedDictionary, selectedDictionaryTrack, t]
    );

    const [deckNames, setDeckNames] = useState<string[]>();
    const [allFieldNames, setAllFieldNames] = useState<string[]>();
    const [ankiError, setAnkiError] = useState<string>();
    const showTokenMatchStrategyPriority = [
        selectedDictionary.dictionaryTokenMatchStrategy,
        selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy,
    ].some(
        (s) => s === TokenMatchStrategy.ANY_FORM_COLLECTED || s === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED
    );
    const selectedDictionaryShowThickness =
        selectedDictionary.tokenStyling === TokenStyling.UNDERLINE ||
        selectedDictionary.tokenStyling === TokenStyling.OVERLINE ||
        selectedDictionary.tokenStyling === TokenStyling.OUTLINE;
    const tokenStylingToHide = useMemo(() => {
        if (selectedDictionary.colorizeFullyKnownTokens) return;
        return getFullyKnownTokenStatus();
    }, [selectedDictionary.colorizeFullyKnownTokens]);

    const [dictionaryYomitanUrlError, setDictionaryYomitanUrlError] = useState<string>();
    const dictionaryRequestYomitan = useCallback(async () => {
        try {
            const yomitan = new Yomitan(selectedDictionary);
            await yomitan.version();
            setDictionaryYomitanUrlError(undefined);
        } catch (e) {
            console.error(e);
            if (e instanceof Error) {
                setDictionaryYomitanUrlError(e.message);
            } else if (typeof e === 'string') {
                setDictionaryYomitanUrlError(e);
            } else {
                setDictionaryYomitanUrlError(String(e));
            }
        }
    }, [selectedDictionary]);

    useEffect(() => {
        let canceled = false;

        const timeout = setTimeout(async () => {
            if (canceled) {
                return;
            }

            dictionaryRequestYomitan();
        }, 1000);

        return () => {
            canceled = true;
            clearTimeout(timeout);
        };
    }, [dictionaryRequestYomitan]);

    useEffect(() => {
        (async () => {
            try {
                setDeckNames((await anki.deckNames(ankiConnectUrl)).sort((a, b) => a.localeCompare(b)));
                const modelNames = await anki.modelNames(ankiConnectUrl);
                const allFieldNamesSet = new Set<string>();
                for (const modelName of modelNames) {
                    const fieldNames = await anki.modelFieldNames(modelName);
                    for (const fieldName of fieldNames) {
                        allFieldNamesSet.add(fieldName);
                    }
                }
                setAllFieldNames(Array.from(allFieldNamesSet).sort((a, b) => a.localeCompare(b)));
            } catch (e) {
                setDeckNames(undefined);
                setAllFieldNames(undefined);
                setAnkiError(e instanceof Error ? e.message : String(e));
            }
        })();
    }, [anki, ankiConnectUrl]);

    const yomitanSectionRef = useRef<HTMLSpanElement | null>(null);
    const handleYomitanHelperTextClicked = () => {
        yomitanSectionRef.current?.scrollIntoView();
    };

    const [buildingAnkiCache, setBuildingAnkiCache] = useState<boolean>(false);
    const [buildAnkiCacheResult, setBuildAnkiCacheResult] = useState<DictionaryBuildAnkiCacheState | undefined>(
        undefined
    );

    const handleBuildAnkiCache = useCallback(async () => {
        try {
            setBuildingAnkiCache(true);
            await dictionaryProvider.buildAnkiCache(activeProfile, settings);
        } catch (e) {
            console.error('Failed to send build Anki cache message', e);
            const message = e instanceof Error ? e.message : String(e);
            setBuildAnkiCacheResult({ command, msg: message, error: true, modifiedTokens: [] });
        } finally {
            setBuildingAnkiCache(false);
        }
    }, [dictionaryProvider, settings, activeProfile]);

    useEffect(() => {
        return dictionaryProvider.onBuildAnkiCacheStateChange((state) => {
            if (state.msg.length) setBuildAnkiCacheResult(state);
        });
    }, [dictionaryProvider]);

    return (
        <Stack spacing={1}>
            {(dictionaryYomitanUrlError || !extensionInstalled) && (
                <Alert severity="info">
                    <Trans
                        i18nKey={`${dictionaryYomitanUrlError ? t('settings.annotationHelperText') : ''}${!extensionInstalled ? ` ${t('settings.annotationNoExtensionWarn')}` : ''}`.trim()}
                        components={[
                            <Link key={0} onClick={handleYomitanHelperTextClicked} href="javascript:void(0)" />,
                        ]}
                    />
                </Alert>
            )}
            <div>
                <Button
                    variant="contained"
                    color="primary"
                    style={{ width: '100%' }}
                    onClick={handleBuildAnkiCache}
                    loading={buildingAnkiCache}
                    startIcon={<RefreshIcon />}
                >
                    {t('settings.buildAnkiCache')}
                </Button>
                <Typography variant="caption" color="textSecondary">
                    {t('settings.buildAnkiCacheHelperText')}
                </Typography>
                {buildAnkiCacheResult && (
                    <div style={{ marginTop: 8 }}>
                        <Alert severity={buildAnkiCacheResult.error ? 'error' : 'success'}>
                            {buildAnkiCacheResult.msg}
                        </Alert>
                    </div>
                )}
            </div>
            <SettingsTextField
                select
                fullWidth
                color="primary"
                variant="outlined"
                size="small"
                label={t('settings.subtitleTrack')!}
                value={selectedDictionaryTrack}
                onChange={(e) => setSelectedDictionaryTrack(Number(e.target.value))}
            >
                {[...Array(NUM_DICTIONARY_TRACKS).keys()].map((i) => (
                    <MenuItem key={i} value={i}>
                        {t('settings.subtitleTrackChoice', { trackNumber: i + 1 })}
                    </MenuItem>
                ))}
            </SettingsTextField>
            <SwitchLabelWithHoverEffect
                control={
                    <Switch
                        checked={selectedDictionary.dictionaryColorizeSubtitles}
                        onChange={(e) => {
                            const newTracks = [...dictionaryTracks];
                            newTracks[selectedDictionaryTrack] = {
                                ...newTracks[selectedDictionaryTrack],
                                dictionaryColorizeSubtitles: e.target.checked,
                            };
                            onSettingChanged('dictionaryTracks', newTracks);
                        }}
                    />
                }
                label={t('settings.dictionaryColorizeSubtitles')}
                labelPlacement="start"
            />
            <FormControl>
                <FormLabel component="legend">{t('settings.dictionaryTokenReadingAnnotation')}</FormLabel>
                <RadioGroup row={false}>
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={
                                    selectedDictionary.dictionaryTokenReadingAnnotation ===
                                    TokenReadingAnnotation.ALWAYS
                                }
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        dictionaryTokenReadingAnnotation: TokenReadingAnnotation.ALWAYS,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenReadingAnnotationAlways')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={
                                    selectedDictionary.dictionaryTokenReadingAnnotation ===
                                    TokenReadingAnnotation.LEARNING_OR_BELOW
                                }
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        dictionaryTokenReadingAnnotation: TokenReadingAnnotation.LEARNING_OR_BELOW,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenReadingAnnotationLearningOrBelow')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={
                                    selectedDictionary.dictionaryTokenReadingAnnotation ===
                                    TokenReadingAnnotation.UNKNOWN_OR_BELOW
                                }
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        dictionaryTokenReadingAnnotation: TokenReadingAnnotation.UNKNOWN_OR_BELOW,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenReadingAnnotationUnknownOrBelow')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={
                                    selectedDictionary.dictionaryTokenReadingAnnotation === TokenReadingAnnotation.NEVER
                                }
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        dictionaryTokenReadingAnnotation: TokenReadingAnnotation.NEVER,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenReadingAnnotationNever')}
                    />
                </RadioGroup>
            </FormControl>
            <SwitchLabelWithHoverEffect
                control={
                    <Switch
                        checked={selectedDictionary.dictionaryColorizeOnHoverOnly}
                        onChange={(e) => {
                            const newTracks = [...dictionaryTracks];
                            newTracks[selectedDictionaryTrack] = {
                                ...newTracks[selectedDictionaryTrack],
                                dictionaryColorizeOnHoverOnly: e.target.checked,
                            };
                            onSettingChanged('dictionaryTracks', newTracks);
                        }}
                    />
                }
                label={t('settings.dictionaryColorizeOnHoverOnly')}
                labelPlacement="start"
            />
            <SettingsSection>{t('settings.coloringStrategy')}</SettingsSection>
            <FormControl>
                <FormLabel component="legend">{t('settings.dictionaryTokenMatchStrategy')}</FormLabel>
                <RadioGroup row={false}>
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={
                                    selectedDictionary.dictionaryTokenMatchStrategy ===
                                    TokenMatchStrategy.ANY_FORM_COLLECTED
                                }
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenMatchStrategyAnyFormCollected')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={
                                    selectedDictionary.dictionaryTokenMatchStrategy ===
                                    TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED
                                }
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        dictionaryTokenMatchStrategy: TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenMatchStrategyLemmaOrExactFormCollected')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={
                                    selectedDictionary.dictionaryTokenMatchStrategy ===
                                    TokenMatchStrategy.LEMMA_FORM_COLLECTED
                                }
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        dictionaryTokenMatchStrategy: TokenMatchStrategy.LEMMA_FORM_COLLECTED,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenMatchStrategyLemmaFormCollected')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={
                                    selectedDictionary.dictionaryTokenMatchStrategy ===
                                    TokenMatchStrategy.EXACT_FORM_COLLECTED
                                }
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        dictionaryTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenMatchStrategyExactFormCollected')}
                    />
                </RadioGroup>
            </FormControl>
            {showTokenMatchStrategyPriority && (
                <FormControl>
                    <FormLabel component="legend">{t('settings.dictionaryTokenMatchStrategyPriority')}</FormLabel>
                    <RadioGroup row={false}>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenMatchStrategyPriority ===
                                        TokenMatchStrategyPriority.EXACT
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyPriorityExact')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenMatchStrategyPriority ===
                                        TokenMatchStrategyPriority.LEMMA
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.LEMMA,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyPriorityLemma')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenMatchStrategyPriority ===
                                        TokenMatchStrategyPriority.BEST_KNOWN
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.BEST_KNOWN,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyPriorityBestKnown')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenMatchStrategyPriority ===
                                        TokenMatchStrategyPriority.LEAST_KNOWN
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenMatchStrategyPriority:
                                                TokenMatchStrategyPriority.LEAST_KNOWN,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyPriorityLeastKnown')}
                        />
                    </RadioGroup>
                </FormControl>
            )}
            <FormControl>
                <FormLabel component="legend">{t('settings.dictionaryAnkiSentenceTokenMatchStrategy')}</FormLabel>
                <RadioGroup row={false}>
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={
                                    selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy ===
                                    TokenMatchStrategy.ANY_FORM_COLLECTED
                                }
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenMatchStrategyAnyFormCollected')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={
                                    selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy ===
                                    TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED
                                }
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        dictionaryAnkiSentenceTokenMatchStrategy:
                                            TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenMatchStrategyLemmaOrExactFormCollected')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={
                                    selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy ===
                                    TokenMatchStrategy.LEMMA_FORM_COLLECTED
                                }
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        dictionaryAnkiSentenceTokenMatchStrategy:
                                            TokenMatchStrategy.LEMMA_FORM_COLLECTED,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenMatchStrategyLemmaFormCollected')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={
                                    selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy ===
                                    TokenMatchStrategy.EXACT_FORM_COLLECTED
                                }
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        dictionaryAnkiSentenceTokenMatchStrategy:
                                            TokenMatchStrategy.EXACT_FORM_COLLECTED,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenMatchStrategyExactFormCollected')}
                    />
                </RadioGroup>
            </FormControl>
            <SettingsSection ref={yomitanSectionRef}>{t('settings.dictionaryYomitanSection')}</SettingsSection>
            {dictionaryYomitanUrlError && (
                <Alert severity="info">
                    <Trans
                        i18nKey={t('settings.yomitanHelperText')}
                        components={[<Link key={0} target="_blank" href="https://github.com/yomidevs/yomitan-api" />]}
                    />
                </Alert>
            )}
            <SettingsTextField
                label={t('settings.dictionaryYomitanUrl')}
                value={selectedDictionary.dictionaryYomitanUrl}
                error={Boolean(dictionaryYomitanUrlError)}
                helperText={getHelperTextForAnkiCacheSettingsDependencies(
                    t('settings.dictionaryYomitanUrl'),
                    'dictionaryYomitanUrl',
                    dictionaryYomitanUrlError
                )}
                color="primary"
                onChange={(e) => {
                    const newTracks = [...dictionaryTracks];
                    newTracks[selectedDictionaryTrack] = {
                        ...newTracks[selectedDictionaryTrack],
                        dictionaryYomitanUrl: e.target.value,
                    };
                    onSettingChanged('dictionaryTracks', newTracks);
                }}
                slotProps={{
                    input: {
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton onClick={dictionaryRequestYomitan}>
                                    <RefreshIcon />
                                </IconButton>
                            </InputAdornment>
                        ),
                    },
                }}
            />
            <SettingsTextField
                type="number"
                label={t('settings.dictionaryYomitanScanLength')}
                value={selectedDictionary.dictionaryYomitanScanLength}
                helperText={getHelperTextForAnkiCacheSettingsDependencies(
                    t('settings.dictionaryYomitanScanLength'),
                    'dictionaryYomitanScanLength'
                )}
                color="primary"
                onChange={(e) => {
                    const newTracks = [...dictionaryTracks];
                    newTracks[selectedDictionaryTrack] = {
                        ...newTracks[selectedDictionaryTrack],
                        dictionaryYomitanScanLength: Number(e.target.value),
                    };
                    onSettingChanged('dictionaryTracks', newTracks);
                }}
                slotProps={{
                    htmlInput: { min: 1, max: 128, step: 1 },
                }}
            />
            <SettingsSection>{t('settings.anki')}</SettingsSection>
            <Autocomplete
                multiple
                options={deckNames ?? []}
                value={selectedDictionary.dictionaryAnkiDecks}
                onChange={(_, newValue) => {
                    const items = newValue as string[];
                    const newTracks = [...dictionaryTracks];
                    newTracks[selectedDictionaryTrack] = {
                        ...newTracks[selectedDictionaryTrack],
                        dictionaryAnkiDecks: items,
                    };
                    onSettingChanged('dictionaryTracks', newTracks);
                }}
                disableCloseOnSelect
                renderOption={(props, option, { selected }) => (
                    <li {...props}>
                        <ListItemIcon>
                            <Checkbox edge="start" checked={selected} tabIndex={-1} disableRipple />
                        </ListItemIcon>
                        <ListItemText primary={option} />
                    </li>
                )}
                renderInput={(params) => (
                    <SettingsTextField
                        {...params}
                        label={t('settings.dictionaryAnkiDecks')}
                        placeholder={t('settings.dictionaryAnkiSelectDecks')}
                        error={Boolean(ankiError)}
                        helperText={getHelperTextForAnkiCacheSettingsDependencies(
                            t('settings.dictionaryAnkiDecks'),
                            'dictionaryAnkiDecks',
                            ankiError
                        )}
                        fullWidth
                    />
                )}
            />
            <Autocomplete
                multiple
                options={allFieldNames ?? []}
                value={selectedDictionary.dictionaryAnkiWordFields}
                onChange={(_, newValue) => {
                    const items = newValue as string[];
                    const newTracks = [...dictionaryTracks];
                    newTracks[selectedDictionaryTrack] = {
                        ...newTracks[selectedDictionaryTrack],
                        dictionaryAnkiWordFields: items,
                    };
                    onSettingChanged('dictionaryTracks', newTracks);
                }}
                disableCloseOnSelect
                renderOption={(props, option, { selected }) => (
                    <li {...props}>
                        <ListItemIcon>
                            <Checkbox edge="start" checked={selected} tabIndex={-1} disableRipple />
                        </ListItemIcon>
                        <ListItemText primary={option} />
                    </li>
                )}
                renderInput={(params) => (
                    <SettingsTextField
                        {...params}
                        label={t('settings.dictionaryAnkiWordFields')}
                        placeholder={t('settings.dictionaryAnkiSelectFields')}
                        error={Boolean(ankiError)}
                        helperText={getHelperTextForAnkiCacheSettingsDependencies(
                            t('settings.dictionaryAnkiWordFields'),
                            'dictionaryAnkiWordFields',
                            ankiError
                        )}
                        fullWidth
                    />
                )}
            />
            <Autocomplete
                multiple
                options={allFieldNames ?? []}
                value={selectedDictionary.dictionaryAnkiSentenceFields}
                onChange={(_, newValue) => {
                    const items = newValue as string[];
                    const newTracks = [...dictionaryTracks];
                    newTracks[selectedDictionaryTrack] = {
                        ...newTracks[selectedDictionaryTrack],
                        dictionaryAnkiSentenceFields: items,
                    };
                    onSettingChanged('dictionaryTracks', newTracks);
                }}
                disableCloseOnSelect
                renderOption={(props, option, { selected }) => (
                    <li {...props}>
                        <ListItemIcon>
                            <Checkbox edge="start" checked={selected} tabIndex={-1} disableRipple />
                        </ListItemIcon>
                        <ListItemText primary={option} />
                    </li>
                )}
                renderInput={(params) => (
                    <SettingsTextField
                        {...params}
                        label={t('settings.dictionaryAnkiSentenceFields')}
                        placeholder={t('settings.dictionaryAnkiSelectFields')}
                        error={Boolean(ankiError)}
                        helperText={getHelperTextForAnkiCacheSettingsDependencies(
                            t('settings.dictionaryAnkiSentenceFields'),
                            'dictionaryAnkiSentenceFields',
                            ankiError
                        )}
                        fullWidth
                    />
                )}
            />
            <SettingsTextField
                type="number"
                label={t('settings.dictionaryAnkiMatureCutoff')}
                value={selectedDictionary.dictionaryAnkiMatureCutoff}
                helperText={getHelperTextForAnkiCacheSettingsDependencies(
                    t('settings.dictionaryAnkiMatureCutoff'),
                    'dictionaryAnkiMatureCutoff'
                )}
                color="primary"
                onChange={(e) => {
                    const newTracks = [...dictionaryTracks];
                    newTracks[selectedDictionaryTrack] = {
                        ...newTracks[selectedDictionaryTrack],
                        dictionaryAnkiMatureCutoff: Number(e.target.value),
                    };
                    onSettingChanged('dictionaryTracks', newTracks);
                }}
                slotProps={{
                    htmlInput: { min: 1, max: 36500, step: 1 },
                }}
            />
            <FormControl>
                <FormLabel component="legend">{t('settings.dictionaryAnkiTreatSuspended')}</FormLabel>
                <RadioGroup row={false}>
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={selectedDictionary.dictionaryAnkiTreatSuspended === 'NORMAL'}
                                onChange={(event) => {
                                    if (!event.target.checked) return;

                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        dictionaryAnkiTreatSuspended: 'NORMAL',
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryAnkiTreatSuspendedNormal')}
                    />
                    {[...Array(NUM_TOKEN_STATUSES).keys()].map((i) => {
                        const tokenStatusIndex = NUM_TOKEN_STATUSES - 1 - i;
                        if (tokenStatusIndex === 0) return null;
                        return (
                            <LabelWithHoverEffect
                                key={i}
                                control={
                                    <Radio
                                        checked={selectedDictionary.dictionaryAnkiTreatSuspended === tokenStatusIndex}
                                        onChange={(event) => {
                                            if (!event.target.checked) return;
                                            const newTracks = [...dictionaryTracks];
                                            newTracks[selectedDictionaryTrack] = {
                                                ...newTracks[selectedDictionaryTrack],
                                                dictionaryAnkiTreatSuspended: tokenStatusIndex,
                                            };
                                            onSettingChanged('dictionaryTracks', newTracks);
                                        }}
                                    />
                                }
                                label={t(`settings.dictionaryTokenStatus${tokenStatusIndex}`)}
                            />
                        );
                    })}
                </RadioGroup>
            </FormControl>
            <SettingsSection>{t('settings.styling')}</SettingsSection>
            <FormControl>
                <FormLabel component="legend">{t('settings.dictionaryTokenStyling')}</FormLabel>
                <RadioGroup row={false}>
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={selectedDictionary.tokenStyling === TokenStyling.TEXT}
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        tokenStyling: TokenStyling.TEXT,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenStylingText')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={selectedDictionary.tokenStyling === TokenStyling.BACKGROUND}
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        tokenStyling: TokenStyling.BACKGROUND,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenStylingBackground')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={selectedDictionary.tokenStyling === TokenStyling.UNDERLINE}
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        tokenStyling: TokenStyling.UNDERLINE,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenStylingUnderline')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={selectedDictionary.tokenStyling === TokenStyling.OVERLINE}
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        tokenStyling: TokenStyling.OVERLINE,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenStylingOverline')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={selectedDictionary.tokenStyling === TokenStyling.OUTLINE}
                                onChange={() => {
                                    const newTracks = [...dictionaryTracks];
                                    newTracks[selectedDictionaryTrack] = {
                                        ...newTracks[selectedDictionaryTrack],
                                        tokenStyling: TokenStyling.OUTLINE,
                                    };
                                    onSettingChanged('dictionaryTracks', newTracks);
                                }}
                            />
                        }
                        label={t('settings.dictionaryTokenStylingOutline')}
                    />
                </RadioGroup>
            </FormControl>
            {selectedDictionary.tokenStyling === TokenStyling.OUTLINE && (
                <Typography variant="caption" color="textSecondary">
                    {t('settings.dictionaryTokenStylingOutlineHelperText')}
                </Typography>
            )}
            {selectedDictionaryShowThickness && (
                <SettingsTextField
                    type="number"
                    label={t('settings.dictionaryTokenStylingThickness')}
                    fullWidth
                    value={selectedDictionary.tokenStylingThickness}
                    color="primary"
                    onChange={(e) => {
                        const newTracks = [...dictionaryTracks];
                        newTracks[selectedDictionaryTrack] = {
                            ...newTracks[selectedDictionaryTrack],
                            tokenStylingThickness: Number(e.target.value),
                        };
                        onSettingChanged('dictionaryTracks', newTracks);
                    }}
                    slotProps={{
                        htmlInput: {
                            min: 0.1,
                            step: 0.1,
                        },
                        input: {
                            endAdornment: <InputAdornment position="end">px</InputAdornment>,
                        },
                    }}
                />
            )}
            <SettingsSection>{t('settings.colors')}</SettingsSection>
            <SwitchLabelWithHoverEffect
                control={
                    <Switch
                        checked={selectedDictionary.colorizeFullyKnownTokens}
                        onChange={(e) => {
                            const newTracks = [...dictionaryTracks];
                            newTracks[selectedDictionaryTrack] = {
                                ...newTracks[selectedDictionaryTrack],
                                colorizeFullyKnownTokens: e.target.checked,
                            };
                            onSettingChanged('dictionaryTracks', newTracks);
                        }}
                    />
                }
                label={t('settings.dictionaryColorizeFullyKnownTokens')}
                labelPlacement="start"
            />
            {[...Array(NUM_TOKEN_STATUSES).keys()].map((i) => {
                const tokenStatusIndex = NUM_TOKEN_STATUSES - 1 - i;
                if (tokenStatusIndex === tokenStylingToHide) return null;
                return (
                    <SettingsTextField
                        key={i}
                        type="color"
                        label={t(`settings.dictionaryTokenStatus${tokenStatusIndex}`)}
                        fullWidth
                        value={selectedDictionary.tokenStatusColors[tokenStatusIndex]}
                        color="primary"
                        onChange={(e) => {
                            const newColors = [...selectedDictionary.tokenStatusColors];
                            newColors[tokenStatusIndex] = e.target.value;
                            const newTracks = [...dictionaryTracks];
                            newTracks[selectedDictionaryTrack] = {
                                ...newTracks[selectedDictionaryTrack],
                                tokenStatusColors: newColors,
                            };
                            onSettingChanged('dictionaryTracks', newTracks);
                        }}
                    />
                );
            })}
        </Stack>
    );
};

export default DictionarySettingsTab;
