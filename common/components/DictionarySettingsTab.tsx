import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import LabelWithHoverEffect from './LabelWithHoverEffect';
import Radio from '@mui/material/Radio';
import Checkbox from '@mui/material/Checkbox';
import RefreshIcon from '@mui/icons-material/Refresh';
import Stack from '@mui/material/Stack';
import InputAdornment from '@mui/material/InputAdornment';
import {
    AsbplayerSettings,
    TokenMatchStrategy,
    TokenMatchStrategyPriority,
    TokenStyling,
    getFullyKnownTokenStatus,
    NUM_TOKEN_STYLINGS,
} from '@project/common/settings';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import RadioGroup from '@mui/material/RadioGroup';
import Autocomplete from '@mui/material/Autocomplete';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { Anki } from '../anki';
import { Yomitan } from '../yomitan/yomitan';
import DictionaryTrackSelector from './DictionaryTrackSelector';
import SwitchLabelWithHoverEffect from './SwitchLabelWithHoverEffect';
import SettingsTextField from './SettingsTextField';

interface Props {
    settings: AsbplayerSettings;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
    anki: Anki;
}

const DictionarySettingsTab: React.FC<Props> = ({ settings, onSettingChanged, anki }) => {
    const { t } = useTranslation();
    const { ankiConnectUrl, dictionaryTracks } = settings;
    const [selectedDictionaryTrack, setSelectedDictionaryTrack] = useState<number>(0);
    const [allFieldNames, setAllFieldNames] = useState<string[]>();
    const [ankiError, setAnkiError] = useState<string>();
    const selectedDictionary = dictionaryTracks[selectedDictionaryTrack];
    const showTokenMatchStrategyPriority =
        selectedDictionary.dictionaryTokenMatchStrategy === TokenMatchStrategy.ANY_FORM_COLLECTED ||
        selectedDictionary.dictionaryTokenMatchStrategy === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED;
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
            const yomitan = new Yomitan();
            await yomitan.version(selectedDictionary.dictionaryYomitanUrl);
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
    }, [selectedDictionary.dictionaryYomitanUrl]);

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
                setAnkiError(e instanceof Error ? e.message : String(e));
            }
        })();
    }, [anki, ankiConnectUrl]);

    return (
        <Stack spacing={1}>
            <DictionaryTrackSelector track={selectedDictionaryTrack} onTrackSelected={setSelectedDictionaryTrack} />
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
            <Typography variant="h6">{t('settings.dictionaryYomitanSection')}</Typography>
            <SettingsTextField
                label={t('settings.dictionaryYomitanUrl')}
                value={selectedDictionary.dictionaryYomitanUrl}
                error={Boolean(dictionaryYomitanUrlError)}
                helperText={dictionaryYomitanUrlError}
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
            <Typography variant="h6">{t('settings.dictionaryAnkiSection')}</Typography>
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
                        placeholder={t('settings.dictionarySelectAnkiFields')}
                        error={Boolean(ankiError)}
                        helperText={ankiError}
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
                        placeholder={t('settings.dictionarySelectAnkiFields')}
                        // error={Boolean(ankiConnectUrlError)}
                        // helperText={ankiConnectUrlError}
                        fullWidth
                    />
                )}
            />
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
            <SettingsTextField
                type="number"
                label={t('settings.dictionaryAnkiMatureCutoff')}
                value={selectedDictionary.dictionaryAnkiMatureCutoff}
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
                    {[...Array(NUM_TOKEN_STYLINGS).keys()].map((i) => {
                        const tokenStatusIndex = NUM_TOKEN_STYLINGS - 1 - i;
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
            <Typography variant="h6">{t('settings.dictionaryTokenStylingSection')}</Typography>
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
                    }}
                />
            )}
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
            {[...Array(NUM_TOKEN_STYLINGS).keys()].map((i) => {
                const tokenStatusIndex = NUM_TOKEN_STYLINGS - 1 - i;
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
