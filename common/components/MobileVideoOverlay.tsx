import Fade from '@material-ui/core/Fade';
import Grid, { GridProps } from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import NoteAddIcon from '@material-ui/icons/NoteAdd';
import NavigateBeforeIcon from '@material-ui/icons/NavigateBefore';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import LoadSubtitlesIcon from '@project/common/components/LoadSubtitlesIcon';
import TuneIcon from '@material-ui/icons/Tune';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { MobileOverlayModel, PlayMode, PostMineAction } from '@project/common';
import SubtitleOffsetInput from '@project/common/app/components/SubtitleOffsetInput';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { useTranslation } from 'react-i18next';
import MuiTooltip, { TooltipProps } from '@material-ui/core/Tooltip';
import LogoIcon from '@project/common/components/LogoIcon';
import HoldableIconButton from './HoldableIconButton';
import PlayModeSelector from '@project/common/app/components/PlayModeSelector';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import CssBaseline from '@material-ui/core/CssBaseline';
import { createTheme } from '@project/common/theme';
import type { PaletteType } from '@material-ui/core';

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

interface ControllableTooltipProps extends TooltipProps {
    disabled: boolean;
}

const Tooltip = ({ children, disabled, ...rest }: ControllableTooltipProps) => {
    if (disabled) {
        return children;
    }

    return <MuiTooltip {...rest}>{children}</MuiTooltip>;
};

const GridContainer = ({ children, ...props }: { children: React.ReactNode } & GridProps) => {
    return (
        <Grid container alignContent="center" justifyContent="center" {...props}>
            {children}
        </Grid>
    );
};

interface Props {
    model?: MobileOverlayModel;
    anchor: Anchor;
    tooltipsEnabled: boolean;
    onMineSubtitle: () => void;
    onLoadSubtitles: () => void;
    onOffset: (offset: number) => void;
    onPlayModeSelected: (playMode: PlayMode) => void;
}

const MobileVideoOverlay = ({
    model,
    anchor,
    tooltipsEnabled,
    onMineSubtitle,
    onLoadSubtitles,
    onOffset,
    onPlayModeSelected,
}: Props) => {
    const classes = useStyles({ anchor });
    const offsetInputRef = useRef<HTMLInputElement>();
    const [playModeSelectorOpen, setPlayModeSelectorOpen] = useState<boolean>(false);
    const [playModeSelectorAnchorEl, setPlayModeSelectorAnchorEl] = useState<HTMLElement>();

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

    const { t } = useTranslation();
    const theme = useMemo(
        () => (model?.themeType === undefined ? undefined : createTheme(model.themeType as PaletteType)),
        [model?.themeType]
    );

    if (!model || !theme) {
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

    const defaultTooltipProps = {
        className: classes.tooltip,
        placement: anchor,
        disabled: !tooltipsEnabled,
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Fade in timeout={300}>
                <>
                    <GridContainer direction="row" wrap="nowrap" className={classes.container}>
                        <Grid item>
                            <Box p={1.5} pl={2}>
                                <LogoIcon />
                            </Box>
                        </Grid>
                        <Grid item>
                            <Tooltip {...defaultTooltipProps} title={miningButtonTooltip(model)!}>
                                {model.emptySubtitleTrack && model.recordingEnabled ? (
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
                        <Grid item>
                            <Tooltip {...defaultTooltipProps} title={t('action.loadSubtitles')!}>
                                <span>
                                    <IconButton disabled={model.recording} onClick={onLoadSubtitles}>
                                        <LoadSubtitlesIcon
                                            className={model.recording ? classes.inactiveButton : classes.button}
                                        />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Grid>
                        {!model.emptySubtitleTrack && (
                            <>
                                <Grid item>
                                    <Tooltip {...defaultTooltipProps} title={t('controls.playbackMode')!}>
                                        <span>
                                            <IconButton disabled={model.recording} onClick={handleOpenPlayModeSelector}>
                                                <TuneIcon
                                                    className={
                                                        model.recording ? classes.inactiveButton : classes.button
                                                    }
                                                />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Grid>
                                <Grid item>
                                    <Tooltip {...defaultTooltipProps} title={t('action.increaseOffsetButton')!}>
                                        <span>
                                            <HoldableIconButton
                                                onClick={handleOffsetToPrevious}
                                                onHold={handleIncrementOffset}
                                                disabled={offsetToPreviousButtonDisabled}
                                            >
                                                <NavigateBeforeIcon
                                                    className={
                                                        offsetToPreviousButtonDisabled
                                                            ? classes.inactiveButton
                                                            : classes.button
                                                    }
                                                />
                                            </HoldableIconButton>
                                        </span>
                                    </Tooltip>
                                </Grid>
                                <Tooltip {...defaultTooltipProps} title={t('controls.subtitleOffset')!}>
                                    <Grid item>
                                        <SubtitleOffsetInput
                                            inputRef={offsetInputRef}
                                            offset={model.offset}
                                            onOffset={onOffset}
                                        />
                                    </Grid>
                                </Tooltip>
                                <Grid item>
                                    <Tooltip {...defaultTooltipProps} title={t('action.decreaseOffsetButton')!}>
                                        <span>
                                            <HoldableIconButton
                                                onClick={handleOffsetToNext}
                                                onHold={handleDecrementOffset}
                                                disabled={offsetToNextButtonDisabled}
                                            >
                                                <NavigateNextIcon
                                                    className={
                                                        offsetToNextButtonDisabled
                                                            ? classes.inactiveButton
                                                            : classes.button
                                                    }
                                                />
                                            </HoldableIconButton>
                                        </span>
                                    </Tooltip>
                                </Grid>
                            </>
                        )}
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
