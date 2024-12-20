import React, { useCallback, useMemo, useRef, useState } from 'react';
import Fade from '@material-ui/core/Fade';
import Grid, { GridProps } from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import NoteAddIcon from '@material-ui/icons/NoteAdd';
import NavigateBeforeIcon from '@material-ui/icons/NavigateBefore';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import TuneIcon from '@material-ui/icons/Tune';
import { MobileOverlayModel, PlayMode, PostMineAction } from '@project/common';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { useTranslation } from 'react-i18next';
import LogoIcon from './LogoIcon';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import CssBaseline from '@material-ui/core/CssBaseline';
import { createTheme } from '@project/common/theme';
import type { PaletteType } from '@material-ui/core';

import SubtitlesIcon from '@material-ui/icons/Subtitles';
import SubtitlesOffIcon from './SubtitlesOffIcon';
import HoldableIconButton from './HoldableIconButton';
import PlayModeSelector from './PlayModeSelector';
import ScrollableNumberControls, { ControlType } from './ScrollableNumberControls';
import Tooltip from './Tooltip';

type Anchor = 'top' | 'bottom';

const useStyles = makeStyles(({ anchor }: { anchor: Anchor }) => ({
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
    playModePopOver: {
        '& .MuiPopover-paper': {
            maxHeight: 'none',
        },
    },
    tooltip: {
        '& .MuiTooltip-tooltipPlacementTop':
            anchor === 'top'
                ? {
                      marginTop: 16,
                  }
                : {},
        '& .MuiTooltip-tooltipPlacementBottom':
            anchor === 'bottom'
                ? {
                      marginBottom: 16,
                  }
                : {},
    },
}));

const GridContainer = ({ children, ...props }: { children: React.ReactNode } & GridProps) => {
    return (
        <Grid container alignContent="center" justifyContent="center" {...props}>
            {children}
        </Grid>
    );
};

interface Props {
    model?: MobileOverlayModel;
    className?: string;
    anchor: Anchor;
    tooltipsEnabled: boolean;
    onMineSubtitle: () => void;
    onLoadSubtitles?: () => void;
    onOffset: (offset: number) => void;
    onPlaybackRate: (playbackRate: number) => void;
    onPlayModeSelected: (playMode: PlayMode) => void;
    onSeek: (timestamp: number) => void;
    onToggleSubtitles: () => void;
}

const MobileVideoOverlay = ({
    model,
    className,
    anchor,
    tooltipsEnabled,
    onMineSubtitle,
    onLoadSubtitles,
    onOffset,
    onPlaybackRate,
    onPlayModeSelected,
    onSeek,
    onToggleSubtitles,
}: Props) => {
    const classes = useStyles({ anchor });
    const offsetInputRef = useRef<HTMLInputElement>();
    const playbackInputRef = useRef<HTMLInputElement>();
    const [playModeSelectorOpen, setPlayModeSelectorOpen] = useState<boolean>(false);
    const [playModeSelectorAnchorEl, setPlayModeSelectorAnchorEl] = useState<HTMLElement>();
    const [numberControlType, setNumberControlType] = useState<ControlType>(ControlType.timeDisplay);

    const handleClosePlayModeSelector = useCallback(() => {
        setPlayModeSelectorOpen(false);
        setPlayModeSelectorAnchorEl(undefined);
    }, []);

    const handleOpenPlayModeSelector = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setPlayModeSelectorAnchorEl(e.currentTarget);
        setPlayModeSelectorOpen(true);
    }, []);

    const handleOffsetToPrevious = useCallback(() => {
        if (!model || model.previousSubtitleTimestamp === undefined) {
            return;
        }

        onOffset(model.currentTimestamp - model.previousSubtitleTimestamp);
    }, [onOffset, model]);

    const handleOffsetToNext = useCallback(() => {
        if (!model || model.nextSubtitleTimestamp === undefined) {
            return;
        }

        onOffset(model.currentTimestamp - model.nextSubtitleTimestamp);
    }, [onOffset, model]);

    const handleIncrementOffset = useCallback(() => {
        if (!model) {
            return;
        }

        onOffset(model.offset + 100);
    }, [onOffset, model]);

    const handleDecrementOffset = useCallback(() => {
        if (!model) {
            return;
        }

        onOffset(model.offset - 100);
    }, [onOffset, model]);

    const handleDecrementPlaybackRate = useCallback(() => {
        if (!model) {
            return;
        }

        onPlaybackRate(Math.max(0.1, model.playbackRate - 0.1));
    }, [onPlaybackRate, model]);

    const handleIncrementPlaybackRate = useCallback(() => {
        if (!model) {
            return;
        }

        onPlaybackRate(Math.min(5, model.playbackRate + 0.1));
    }, [onPlaybackRate, model]);

    const handleSeekToPreviousSubtitle = useCallback(() => {
        if (!model || model.previousSubtitleTimestamp === undefined) {
            return;
        }

        onSeek(model.previousSubtitleTimestamp);
    }, [onSeek, model]);

    const handleSeekBackwards = useCallback(() => {
        if (!model) {
            return;
        }

        onSeek(Math.max(0, model.currentTimestamp - 10000));
    }, [onSeek, model]);

    const handleSeekToNextSubtitle = useCallback(() => {
        if (!model || model.nextSubtitleTimestamp === undefined) {
            return;
        }

        onSeek(model.nextSubtitleTimestamp);
    }, [onSeek, model]);

    const handleSeekForwards = useCallback(() => {
        if (!model) {
            return;
        }

        onSeek(model.currentTimestamp + 10000);
    }, [onSeek, model]);

    const handleLeftNumberControl = useCallback(() => {
        switch (numberControlType) {
            case ControlType.timeDisplay:
                if (model?.emptySubtitleTrack) {
                    handleSeekBackwards();
                } else {
                    handleSeekToPreviousSubtitle();
                }
                break;
            case ControlType.subtitleOffset:
                handleOffsetToPrevious();
                break;
            case ControlType.playbackRate:
                handleDecrementPlaybackRate();
                break;
        }
    }, [
        numberControlType,
        model?.emptySubtitleTrack,
        handleSeekBackwards,
        handleSeekToPreviousSubtitle,
        handleOffsetToPrevious,
        handleDecrementPlaybackRate,
    ]);

    const handleRightNumberControl = useCallback(() => {
        switch (numberControlType) {
            case ControlType.timeDisplay:
                if (model?.emptySubtitleTrack) {
                    handleSeekForwards();
                } else {
                    handleSeekToNextSubtitle();
                }
                break;
            case ControlType.subtitleOffset:
                handleOffsetToNext();
                break;
            case ControlType.playbackRate:
                handleIncrementPlaybackRate();
                break;
        }
    }, [
        numberControlType,
        model?.emptySubtitleTrack,
        handleSeekForwards,
        handleSeekToNextSubtitle,
        handleOffsetToNext,
        handleIncrementPlaybackRate,
    ]);

    const handleHoldLeftNumberControl = useCallback(() => {
        switch (numberControlType) {
            case ControlType.timeDisplay:
                // ignore
                break;
            case ControlType.subtitleOffset:
                handleIncrementOffset();
                break;
            case ControlType.playbackRate:
                handleDecrementPlaybackRate();
                break;
        }
    }, [numberControlType, handleIncrementOffset, handleDecrementPlaybackRate]);

    const handleHoldRightNumberControl = useCallback(() => {
        switch (numberControlType) {
            case ControlType.timeDisplay:
                // ignore
                break;
            case ControlType.subtitleOffset:
                handleDecrementOffset();
                break;
            case ControlType.playbackRate:
                handleIncrementPlaybackRate();
                break;
        }
    }, [numberControlType, handleDecrementOffset, handleIncrementPlaybackRate]);

    const { t } = useTranslation();
    const theme = useMemo(
        () => (model?.themeType === undefined ? undefined : createTheme(model.themeType as PaletteType)),
        [model?.themeType]
    );

    const { leftNumberControlTitle, numberControlTitle, rightNumberControlTitle } = useMemo(() => {
        switch (numberControlType) {
            case ControlType.timeDisplay:
                return {
                    leftNumberControlTitle: model?.emptySubtitleTrack
                        ? t('binds.seekBackward')
                        : t('binds.seekToPreviousSubtitle'),
                    numberControlTitle: t('controls.currentTimestamp'),
                    rightNumberControlTitle: model?.emptySubtitleTrack
                        ? t('binds.seekForward')
                        : t('binds.seekToNextSubtitle'),
                };
            case ControlType.subtitleOffset:
                return {
                    leftNumberControlTitle: t('action.increaseOffsetButton'),
                    numberControlTitle: t('controls.subtitleOffset'),
                    rightNumberControlTitle: t('action.decreaseOffsetButton'),
                };

            case ControlType.playbackRate:
                return {
                    leftNumberControlTitle: t('binds.decreasePlaybackRate'),
                    numberControlTitle: t('controls.playbackRate'),
                    rightNumberControlTitle: t('binds.increasePlaybackRate'),
                };
        }
    }, [numberControlType, model, t]);

    if (!model || !theme) {
        return null;
    }

    let rightNumberControlDisabled: boolean;
    let leftNumberControlDisabled: boolean;

    switch (numberControlType) {
        case ControlType.timeDisplay:
            rightNumberControlDisabled =
                (!model.emptySubtitleTrack && model.nextSubtitleTimestamp === undefined) || model.recording;
            leftNumberControlDisabled =
                (!model.emptySubtitleTrack && model.previousSubtitleTimestamp === undefined) ||
                model.recording ||
                model.currentTimestamp === 0;
            break;
        case ControlType.subtitleOffset:
            rightNumberControlDisabled = model.nextSubtitleTimestamp === undefined || model.recording;
            leftNumberControlDisabled = model.previousSubtitleTimestamp === undefined || model.recording;
            break;
        case ControlType.playbackRate:
            rightNumberControlDisabled = model.playbackRate >= 5 || model.recording;
            leftNumberControlDisabled = model.playbackRate <= 0.1 || model.recording;
            break;
    }

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

    const defaultTooltipProps = {
        className: classes.tooltip,
        placement: anchor,
        disabled: !tooltipsEnabled,
    };

    const containerClassName = className === undefined ? classes.container : `${className} ${classes.container}`;
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Fade in timeout={300}>
                <>
                    <GridContainer direction="row" wrap="nowrap" className={containerClassName}>
                        {onLoadSubtitles && (
                            <Grid item>
                                <Tooltip {...defaultTooltipProps} title={t('action.loadSubtitles')!}>
                                    <IconButton disabled={model.recording} onClick={onLoadSubtitles}>
                                        <LogoIcon
                                            className={model.recording ? classes.inactiveButton : classes.button}
                                        />
                                    </IconButton>
                                </Tooltip>
                            </Grid>
                        )}
                        <Grid item>
                            <Tooltip {...defaultTooltipProps} title={miningButtonTooltip(model)!}>
                                {model.emptySubtitleTrack &&
                                model.recordingEnabled &&
                                !model.manualRecordingDisabled ? (
                                    // Wrap in span so that Tooltip doesn't complain about disabled child. Spacing also looks better.
                                    <span>
                                        <IconButton onClick={onMineSubtitle}>
                                            <FiberManualRecordIcon
                                                className={model.recording ? classes.recordingButton : classes.button}
                                            />
                                        </IconButton>
                                    </span>
                                ) : (
                                    <span>
                                        <IconButton disabled={miningButtonDisabled} onClick={onMineSubtitle}>
                                            <NoteAddIcon
                                                className={
                                                    miningButtonDisabled ? classes.inactiveButton : classes.button
                                                }
                                            />
                                        </IconButton>
                                    </span>
                                )}
                            </Tooltip>
                        </Grid>
                        {!model.emptySubtitleTrack && (
                            <Grid item>
                                <Tooltip {...defaultTooltipProps} title={t('binds.toggleSubtitles')!}>
                                    <span>
                                        <IconButton disabled={model.recording} onClick={onToggleSubtitles}>
                                            {model.subtitlesAreVisible && (
                                                <SubtitlesOffIcon
                                                    className={
                                                        model.recording ? classes.inactiveButton : classes.button
                                                    }
                                                />
                                            )}
                                            {!model.subtitlesAreVisible && (
                                                <SubtitlesIcon
                                                    className={
                                                        model.recording ? classes.inactiveButton : classes.button
                                                    }
                                                />
                                            )}
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Grid>
                        )}
                        {!model.emptySubtitleTrack && (
                            <Grid item>
                                <Tooltip {...defaultTooltipProps} title={t('controls.playbackMode')!}>
                                    <span>
                                        <IconButton disabled={model.recording} onClick={handleOpenPlayModeSelector}>
                                            <TuneIcon
                                                className={model.recording ? classes.inactiveButton : classes.button}
                                            />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Grid>
                        )}
                        <Grid item>
                            <Tooltip {...defaultTooltipProps} title={leftNumberControlTitle}>
                                <span>
                                    <HoldableIconButton
                                        onClick={handleLeftNumberControl}
                                        onHold={handleHoldLeftNumberControl}
                                        disabled={leftNumberControlDisabled}
                                    >
                                        <NavigateBeforeIcon
                                            className={
                                                leftNumberControlDisabled ? classes.inactiveButton : classes.button
                                            }
                                        />
                                    </HoldableIconButton>
                                </span>
                            </Tooltip>
                        </Grid>
                        <Tooltip {...defaultTooltipProps} title={numberControlTitle}>
                            <Grid item>
                                <ScrollableNumberControls
                                    offsetInputRef={offsetInputRef}
                                    playbackRateInputRef={playbackInputRef}
                                    offset={model.offset}
                                    onOffset={onOffset}
                                    playbackRate={model.playbackRate}
                                    onPlaybackRate={onPlaybackRate}
                                    onScrollTo={setNumberControlType}
                                    currentMilliseconds={model.currentTimestamp}
                                />
                            </Grid>
                        </Tooltip>
                        <Grid item>
                            <Tooltip {...defaultTooltipProps} title={rightNumberControlTitle}>
                                <span>
                                    <HoldableIconButton
                                        onClick={handleRightNumberControl}
                                        onHold={handleHoldRightNumberControl}
                                        disabled={rightNumberControlDisabled}
                                    >
                                        <NavigateNextIcon
                                            className={
                                                rightNumberControlDisabled ? classes.inactiveButton : classes.button
                                            }
                                        />
                                    </HoldableIconButton>
                                </span>
                            </Tooltip>
                        </Grid>
                    </GridContainer>
                    {playModeSelectorOpen && (
                        <PlayModeSelector
                            open={playModeSelectorOpen}
                            anchorEl={playModeSelectorAnchorEl}
                            onClose={handleClosePlayModeSelector}
                            selectedPlayMode={model.playMode}
                            onPlayMode={onPlayModeSelected}
                            listStyle={{
                                display: 'flex',
                                flexDirection: 'row',
                                padding: 0,
                                overflowX: 'auto',
                            }}
                            className={classes.playModePopOver}
                            anchorOrigin={{
                                vertical: 'center',
                                horizontal: 'center',
                            }}
                            transformOrigin={{
                                vertical: 'center',
                                horizontal: 'center',
                            }}
                        />
                    )}
                </>
            </Fade>
        </ThemeProvider>
    );
};

export default MobileVideoOverlay;