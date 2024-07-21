import Fade from '@material-ui/core/Fade';
import Grid, { GridProps } from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import NoteAddIcon from '@material-ui/icons/NoteAdd';
import NavigateBeforeIcon from '@material-ui/icons/NavigateBefore';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import SubtitlesIcon from '@material-ui/icons/Subtitles';
import React, { useCallback, useRef } from 'react';
import {
    AsbPlayerToVideoCommandV2,
    CopySubtitleMessage,
    LoadSubtitlesMessage,
    MobileOverlayCommand,
    MobileOverlayModel,
    OffsetToVideoMessage,
    PostMineAction,
    SettingsUpdatedMessage,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { ExtensionSettingsStorage } from '../../services/extension-settings-storage';
import SubtitleOffsetInput from '@project/common/app/components/SubtitleOffsetInput';
import { useMobileVideoOverlayLocation } from '../hooks/use-mobile-video-overlay-location';
import { useMobileVideoOverlayModel } from '../hooks/use-mobile-video-overlay-model';
import makeStyles from '@material-ui/core/styles/makeStyles';
import withStyles from '@material-ui/core/styles/withStyles';
import { useI18n } from '../hooks/use-i18n';
import { useTranslation } from 'react-i18next';
import MuiTooltip, { TooltipProps } from '@material-ui/core/Tooltip';
import LogoIcon from '@project/common/components/LogoIcon';
import CloseIcon from '@material-ui/icons/Close';
import HoldableIconButton from './HoldableIconButton';

const useStyles = makeStyles({
    button: {
        color: 'white',
    },
    inactiveButton: {
        color: 'rgba(120, 120, 120, 0.7)',
    },
    recordingButton: {
        color: 'red',
    },
    container: {
        display: 'inline-flex',
        width: 'auto',
        backgroundColor: 'rgba(0, 0, 0, .7)',
        borderRadius: 16,
    },
});
const params = new URLSearchParams(location.search);
const anchor = params.get('anchor') as 'top' | 'bottom';
const tooltipsEnabled = params.get('tooltips') === 'true';

const DisabledTooltip = ({ children }: { children: React.ReactNode } & TooltipProps) => {
    return children;
};

let Tooltip =
    anchor === 'bottom'
        ? withStyles({ tooltipPlacementBottom: { marginTop: 0, marginBottom: 16 } })(MuiTooltip)
        : withStyles({ tooltipPlacementTop: { marginTop: 16, marginBottom: 0 } })(MuiTooltip);

if (!tooltipsEnabled) {
    Tooltip = DisabledTooltip;
}

const GridContainer = ({ children, ...props }: { children: React.ReactNode } & GridProps) => {
    return (
        <Grid container alignContent="center" justifyContent="center" {...props}>
            {children}
        </Grid>
    );
};

const settings = new SettingsProvider(new ExtensionSettingsStorage());

const MobileVideoOverlay = () => {
    const classes = useStyles();
    const offsetInputRef = useRef<HTMLInputElement>();
    const location = useMobileVideoOverlayLocation();

    const handleMineSubtitle = useCallback(async () => {
        if (!location) {
            return;
        }

        const command: AsbPlayerToVideoCommandV2<CopySubtitleMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'copy-subtitle',
                postMineAction: await settings.getSingle('clickToMineDefaultAction'),
            },
            tabId: location.tabId,
            src: location.src,
        };
        chrome.runtime.sendMessage(command);
    }, [location]);

    const handleLoadSubtitles = useCallback(() => {
        if (!location) {
            return;
        }

        const command: AsbPlayerToVideoCommandV2<LoadSubtitlesMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'load-subtitles' },
            tabId: location.tabId,
            src: location.src,
        };
        chrome.runtime.sendMessage(command);
    }, [location]);

    const handleOffset = useCallback(
        (offset: number) => {
            if (!location) {
                return;
            }

            const command: AsbPlayerToVideoCommandV2<OffsetToVideoMessage> = {
                sender: 'asbplayerv2',
                message: { command: 'offset', value: offset },
                tabId: location.tabId,
                src: location.src,
            };
            chrome.runtime.sendMessage(command);
        },
        [location]
    );

    const model = useMobileVideoOverlayModel({ location });

    const handleOffsetToPrevious = useCallback(() => {
        if (!model || model.previousSubtitleTimestamp === undefined) {
            return;
        }

        handleOffset(model.currentTimestamp - model.previousSubtitleTimestamp);
    }, [handleOffset, model]);

    const handleOffsetToNext = useCallback(() => {
        if (!model || model.nextSubtitleTimestamp === undefined) {
            return;
        }

        handleOffset(model.currentTimestamp - model.nextSubtitleTimestamp);
    }, [handleOffset, model]);

    const handleIncrementOffset = useCallback(() => {
        if (!model) {
            return;
        }

        handleOffset(model.offset + 100);
    }, [handleOffset, model]);

    const handleDecrementOffset = useCallback(() => {
        if (!model) {
            return;
        }

        handleOffset(model.offset - 100);
    }, [handleOffset, model]);

    const handleDisableOverlay = useCallback(async () => {
        await settings.set({ streamingEnableOverlay: false });
        const command: MobileOverlayCommand<SettingsUpdatedMessage> = {
            sender: 'asbplayer-mobile-overlay',
            message: {
                command: 'settings-updated',
            },
        };
        chrome.runtime.sendMessage(command);
    }, []);

    const { initialized: i18nInitialized } = useI18n({ language: model?.language ?? 'en' });
    const { t } = useTranslation();

    if (!model || !i18nInitialized) {
        return null;
    }

    const offsetToPreviousButtonDisabled = model.previousSubtitleTimestamp === undefined || model.recording;
    const offsetToNextButtonDisabled = model.nextSubtitleTimestamp === undefined || model.recording;
    const miningButtonDisabled = (!model.emptySubtitleTrack && !model.subtitleDisplaying) || model.recording;

    function miningButtonTooltip(model: MobileOverlayModel) {
        if (!model) {
            return null;
        }

        if (model.emptySubtitleTrack) {
            if (model.recordingEnabled) {
                return model.recording ? t('action.stopRecording') : t('action.startRecording');
            }

            return t('action.mine');
        }

        switch (model.postMineAction) {
            case PostMineAction.exportCard:
            case PostMineAction.showAnkiDialog:
            case PostMineAction.none:
                return t('action.mine');
            case PostMineAction.updateLastCard:
                return t('action.updateLastCard');
        }
    }

    return (
        <Fade in timeout={300}>
            <GridContainer direction="row" wrap="nowrap" className={classes.container}>
                <Grid item>
                    <Box p={1.5} pl={2}>
                        <LogoIcon />
                    </Box>
                </Grid>
                <Grid item>
                    <Tooltip placement={anchor} title={miningButtonTooltip(model)!}>
                        {model.emptySubtitleTrack && model.recordingEnabled ? (
                            // Wrap in span so that Tooltip doesn't complain about disabled child. Spacing also looks better.
                            <span>
                                <IconButton onClick={handleMineSubtitle}>
                                    <FiberManualRecordIcon
                                        className={model.recording ? classes.recordingButton : classes.button}
                                    />
                                </IconButton>
                            </span>
                        ) : (
                            <span>
                                <IconButton disabled={miningButtonDisabled} onClick={handleMineSubtitle}>
                                    <NoteAddIcon
                                        className={miningButtonDisabled ? classes.inactiveButton : classes.button}
                                    />
                                </IconButton>
                            </span>
                        )}
                    </Tooltip>
                </Grid>
                <Grid item>
                    <Tooltip placement={anchor} title={t('action.loadSubtitles')!}>
                        <span>
                            <IconButton disabled={model.recording} onClick={handleLoadSubtitles}>
                                <SubtitlesIcon className={model.recording ? classes.inactiveButton : classes.button} />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Grid>
                {!model.emptySubtitleTrack && (
                    <>
                        <Grid item>
                            <Tooltip placement={anchor} title={t('action.increaseOffsetButton')!}>
                                <span>
                                    <HoldableIconButton
                                        onClick={handleOffsetToPrevious}
                                        onHold={handleIncrementOffset}
                                        disabled={offsetToPreviousButtonDisabled}
                                    >
                                        <NavigateBeforeIcon
                                            className={
                                                offsetToPreviousButtonDisabled ? classes.inactiveButton : classes.button
                                            }
                                        />
                                    </HoldableIconButton>
                                </span>
                            </Tooltip>
                        </Grid>
                        <Tooltip placement={anchor} title={t('controls.subtitleOffset')!}>
                            <Grid item>
                                <SubtitleOffsetInput
                                    inputRef={offsetInputRef}
                                    offset={model.offset}
                                    onOffset={handleOffset}
                                />
                            </Grid>
                        </Tooltip>
                        <Grid item>
                            <Tooltip placement={anchor} title={t('action.decreaseOffsetButton')!}>
                                <span>
                                    <HoldableIconButton
                                        onClick={handleOffsetToNext}
                                        onHold={handleDecrementOffset}
                                        disabled={offsetToNextButtonDisabled}
                                    >
                                        <NavigateNextIcon
                                            className={
                                                offsetToNextButtonDisabled ? classes.inactiveButton : classes.button
                                            }
                                        />
                                    </HoldableIconButton>
                                </span>
                            </Tooltip>
                        </Grid>
                    </>
                )}
                <Grid item>
                    <Tooltip placement={anchor} title={t('action.hideOverlay')!}>
                        <span>
                            <IconButton disabled={model.recording} onClick={handleDisableOverlay}>
                                <CloseIcon className={classes.button} />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Grid>
            </GridContainer>
        </Fade>
    );
};

export default MobileVideoOverlay;
