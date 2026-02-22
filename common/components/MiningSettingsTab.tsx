import TextField from './SettingsTextField';
import React from 'react';
import { useTranslation } from 'react-i18next';
import FormLabel from '@mui/material/FormLabel';
import InputAdornment from '@mui/material/InputAdornment';
import LabelWithHoverEffect from './LabelWithHoverEffect';
import SwitchLabelWithHoverEffect from './SwitchLabelWithHoverEffect';
import Radio from '@mui/material/Radio';
import { PostMineAction, PostMinePlayback } from '@project/common';
import { AsbplayerSettings, MiningScreenshotCaptureTimestamp } from '@project/common/settings';
import Switch from '@mui/material/Switch';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import { FormControl } from '@mui/material';
import SettingsSection from './SettingsSection';
import MenuItem from '@mui/material/MenuItem';

interface Props {
    settings: AsbplayerSettings;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
}

const MiningSettingsTab: React.FC<Props> = ({ settings, onSettingChanged }) => {
    const { t } = useTranslation();
    const {
        audioPaddingStart,
        audioPaddingEnd,
        maxImageWidth,
        maxImageHeight,
        streamingScreenshotDelay,
        surroundingSubtitlesCountRadius,
        surroundingSubtitlesTimeRadius,
        clickToMineDefaultAction,
        postMiningPlaybackState,
        recordWithAudioPlayback,
        preferMp3,
        copyToClipboardOnMine,
        miningScreenshotCaptureTimestamp,
    } = settings;
    return (
        <Stack spacing={1}>
            <FormControl>
                <FormLabel component="legend">{t('settings.clickToMineDefaultAction')}</FormLabel>
                <RadioGroup row={false}>
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={clickToMineDefaultAction === PostMineAction.showAnkiDialog}
                                value={PostMineAction.showAnkiDialog}
                                onChange={(event) =>
                                    event.target.checked &&
                                    onSettingChanged('clickToMineDefaultAction', PostMineAction.showAnkiDialog)
                                }
                            />
                        }
                        label={t('postMineAction.showAnkiDialog')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={clickToMineDefaultAction === PostMineAction.updateLastCard}
                                value={PostMineAction.updateLastCard}
                                onChange={(event) =>
                                    event.target.checked &&
                                    onSettingChanged('clickToMineDefaultAction', PostMineAction.updateLastCard)
                                }
                            />
                        }
                        label={t('postMineAction.updateLastCard')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={clickToMineDefaultAction === PostMineAction.exportCard}
                                value={PostMineAction.exportCard}
                                onChange={(event) =>
                                    event.target.checked &&
                                    onSettingChanged('clickToMineDefaultAction', PostMineAction.exportCard)
                                }
                            />
                        }
                        label={t('postMineAction.exportCard')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={clickToMineDefaultAction === PostMineAction.none}
                                value={PostMineAction.none}
                                onChange={(event) =>
                                    event.target.checked &&
                                    onSettingChanged('clickToMineDefaultAction', PostMineAction.none)
                                }
                            />
                        }
                        label={t('postMineAction.none')}
                    />
                </RadioGroup>
            </FormControl>

            <FormControl>
                <FormLabel component="legend">{t('settings.postMinePlayback')}</FormLabel>
                <RadioGroup row={false}>
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={postMiningPlaybackState === PostMinePlayback.remember}
                                value={PostMinePlayback.remember}
                                onChange={(event) =>
                                    event.target.checked &&
                                    onSettingChanged('postMiningPlaybackState', PostMinePlayback.remember)
                                }
                            />
                        }
                        label={t('postMinePlayback.remember')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={postMiningPlaybackState === PostMinePlayback.play}
                                value={PostMinePlayback.play}
                                onChange={(event) =>
                                    event.target.checked &&
                                    onSettingChanged('postMiningPlaybackState', PostMinePlayback.play)
                                }
                            />
                        }
                        label={t('postMinePlayback.play')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={postMiningPlaybackState === PostMinePlayback.pause}
                                value={PostMinePlayback.pause}
                                onChange={(event) =>
                                    event.target.checked &&
                                    onSettingChanged('postMiningPlaybackState', PostMinePlayback.pause)
                                }
                            />
                        }
                        label={t('postMinePlayback.pause')}
                    />
                </RadioGroup>
            </FormControl>
            <SwitchLabelWithHoverEffect
                control={
                    <Switch
                        checked={copyToClipboardOnMine}
                        onChange={(event) => onSettingChanged('copyToClipboardOnMine', event.target.checked)}
                    />
                }
                label={t('settings.copyOnMine')}
                labelPlacement="start"
            />
            <SettingsSection>{t('settings.audio')}</SettingsSection>
            <SwitchLabelWithHoverEffect
                control={
                    <Switch
                        checked={recordWithAudioPlayback}
                        onChange={(event) => onSettingChanged('recordWithAudioPlayback', event.target.checked)}
                    />
                }
                label={t('settings.recordWithAudioPlayback')}
                labelPlacement="start"
            />
            <SwitchLabelWithHoverEffect
                control={
                    <Switch
                        checked={preferMp3}
                        onChange={(event) => onSettingChanged('preferMp3', event.target.checked)}
                    />
                }
                label={t('settings.mp3Preference')}
                labelPlacement="start"
            />

            <TextField
                type="number"
                label={t('settings.audioPaddingStart')}
                fullWidth
                value={audioPaddingStart}
                color="primary"
                onChange={(event) => onSettingChanged('audioPaddingStart', Number(event.target.value))}
                slotProps={{
                    htmlInput: {
                        min: 0,
                        step: 1,
                    },
                    input: {
                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                    },
                }}
            />
            <TextField
                type="number"
                label={t('settings.audioPaddingEnd')}
                fullWidth
                value={audioPaddingEnd}
                color="primary"
                onChange={(event) => onSettingChanged('audioPaddingEnd', Number(event.target.value))}
                slotProps={{
                    htmlInput: {
                        step: 1,
                        min: 0,
                    },
                    input: {
                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                    },
                }}
            />
            <SettingsSection>{t('settings.screenshots')}</SettingsSection>
            <TextField
                type="number"
                label={t('settings.maxImageWidth')}
                fullWidth
                value={maxImageWidth}
                color="primary"
                onChange={(event) => onSettingChanged('maxImageWidth', Number(event.target.value))}
                slotProps={{
                    htmlInput: {
                        min: 0,
                        step: 1,
                    },
                }}
            />
            <TextField
                type="number"
                label={t('settings.maxImageHeight')}
                fullWidth
                value={maxImageHeight}
                color="primary"
                onChange={(event) => onSettingChanged('maxImageHeight', Number(event.target.value))}
                slotProps={{
                    htmlInput: {
                        min: 0,
                        step: 1,
                    },
                }}
            />
            <TextField
                select
                label={t('settings.miningScreenshotCaptureTimestamp')}
                fullWidth
                value={miningScreenshotCaptureTimestamp}
                color="primary"
                onChange={(event) =>
                    onSettingChanged(
                        'miningScreenshotCaptureTimestamp',
                        event.target.value as MiningScreenshotCaptureTimestamp
                    )
                }
            >
                <MenuItem value={MiningScreenshotCaptureTimestamp.beginning}>
                    {t('settings.miningScreenshotCaptureTimestampBeginning')}
                </MenuItem>
                <MenuItem value={MiningScreenshotCaptureTimestamp.afterBeginning}>
                    {t('settings.miningScreenshotCaptureTimestampAfterBeginning')}
                </MenuItem>
                <MenuItem value={MiningScreenshotCaptureTimestamp.middle}>
                    {t('settings.miningScreenshotCaptureTimestampMiddle')}
                </MenuItem>
                <MenuItem value={MiningScreenshotCaptureTimestamp.beforeEnding}>
                    {t('settings.miningScreenshotCaptureTimestampBeforeEnding')}
                </MenuItem>
                <MenuItem value={MiningScreenshotCaptureTimestamp.ending}>
                    {t('settings.miningScreenshotCaptureTimestampEnding')}
                </MenuItem>
            </TextField>
            {miningScreenshotCaptureTimestamp === MiningScreenshotCaptureTimestamp.beginning && (
                <TextField
                    type="number"
                    label={t('extension.settings.screenshotCaptureDelay')}
                    fullWidth
                    value={streamingScreenshotDelay}
                    color="primary"
                    onChange={(event) => onSettingChanged('streamingScreenshotDelay', Number(event.target.value))}
                    slotProps={{
                        htmlInput: {
                            min: 0,
                            step: 1,
                        },
                        input: {
                            endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                        },
                    }}
                />
            )}
            <SettingsSection>{t('settings.exportDialog')}</SettingsSection>
            <TextField
                type="number"
                label={t('settings.surroundingSubtitlesCountRadius')}
                fullWidth
                value={surroundingSubtitlesCountRadius}
                color="primary"
                onChange={(event) => onSettingChanged('surroundingSubtitlesCountRadius', Number(event.target.value))}
                slotProps={{
                    htmlInput: {
                        min: 1,
                        step: 1,
                    },
                }}
            />
            <TextField
                type="number"
                label={t('settings.surroundingSubtitlesTimeRadius')}
                fullWidth
                value={surroundingSubtitlesTimeRadius}
                color="primary"
                onChange={(event) => onSettingChanged('surroundingSubtitlesTimeRadius', Number(event.target.value))}
                slotProps={{
                    htmlInput: {
                        min: 0,
                        step: 1,
                    },
                    input: {
                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                    },
                }}
            />
        </Stack>
    );
};

export default MiningSettingsTab;
