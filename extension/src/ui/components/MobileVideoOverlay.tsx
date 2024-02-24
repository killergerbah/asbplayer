import Fade from '@material-ui/core/Fade';
import Grid, { GridProps } from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import NoteAddIcon from '@material-ui/icons/NoteAdd';
import NavigateBeforeIcon from '@material-ui/icons/NavigateBefore';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import SubtitlesIcon from '@material-ui/icons/Subtitles';
import { useCallback, useRef } from 'react';
import {
    CopySubtitleMessage,
    ExtensionToVideoCommand,
    LoadSubtitlesMessage,
    MobileOverlayModel,
    OffsetToVideoMessage,
    PostMineAction,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { ExtensionSettingsStorage } from '../../services/extension-settings-storage';
import SubtitleOffsetInput from '@project/common/app/components/SubtitleOffsetInput';
import { useMobileVideoOverlayLocation } from '../hooks/use-mobile-video-overlay-location';
import { useMobileVideoOverlayModel } from '../hooks/use-mobile-video-overlay-model';
import { makeStyles } from '@material-ui/core/styles';
import { useI18n } from '../hooks/use-i18n';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@material-ui/core';

const useStyles = makeStyles({
    button: {
        color: 'white',
    },
    recordingButton: {
        color: 'red',
    },
    container: {
        display: 'inline-flex',
        width: 'auto',
        backgroundColor: 'rgba(0, 0, 0, .5)',
        backdropFilter: 'blur(3px)',
        borderRadius: 16,
    },
});

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

        const command: ExtensionToVideoCommand<CopySubtitleMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: { command: 'copy-subtitle', postMineAction: await settings.getSingle('clickToMineDefaultAction') },
            src: location.src,
        };
        chrome.tabs.sendMessage(location.tabId, command);
    }, [location]);

    const handleLoadSubtitles = useCallback(() => {
        if (!location) {
            return;
        }

        const command: ExtensionToVideoCommand<LoadSubtitlesMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: { command: 'load-subtitles' },
            src: location.src,
        };
        chrome.tabs.sendMessage(location.tabId, command);
    }, [location]);

    const handleOffset = useCallback(
        (offset: number) => {
            if (!location) {
                return;
            }

            const command: ExtensionToVideoCommand<OffsetToVideoMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: { command: 'offset', value: offset },
                src: location.src,
            };
            chrome.tabs.sendMessage(location.tabId, command);
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

    const { initialized: i18nInitialized } = useI18n({ language: model?.language ?? 'en' });
    const { t } = useTranslation();

    if (!model || !i18nInitialized) {
        return null;
    }

    const offsetToPreviousButtonDisabled = model.previousSubtitleTimestamp === undefined;
    const offsetToNextButtonDisabled = model.nextSubtitleTimestamp === undefined;
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
                    <Tooltip title={miningButtonTooltip(model)!}>
                        {model.emptySubtitleTrack && model.recordingEnabled ? (
                            <IconButton onClick={handleMineSubtitle}>
                                <FiberManualRecordIcon
                                    className={model.recording ? classes.recordingButton : classes.button}
                                />
                            </IconButton>
                        ) : (
                            // Wrap in span so that Tooltip doesn't complain about disabled child
                            <span>
                                <IconButton disabled={miningButtonDisabled} onClick={handleMineSubtitle}>
                                    <NoteAddIcon className={miningButtonDisabled ? '' : classes.button} />
                                </IconButton>
                            </span>
                        )}
                    </Tooltip>
                </Grid>
                <Grid item>
                    <Tooltip title={t('action.loadSubtitles')!}>
                        <span>
                            <IconButton disabled={model.recording} onClick={handleLoadSubtitles}>
                                <SubtitlesIcon className={model.recording ? '' : classes.button} />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Grid>
                {!model.emptySubtitleTrack && (
                    <>
                        <Grid item>
                            <IconButton onClick={handleOffsetToPrevious} disabled={offsetToPreviousButtonDisabled}>
                                <NavigateBeforeIcon className={offsetToPreviousButtonDisabled ? '' : classes.button} />
                            </IconButton>
                        </Grid>
                        <Grid item>
                            <SubtitleOffsetInput
                                inputRef={offsetInputRef}
                                offset={model.offset}
                                onOffset={handleOffset}
                            />
                        </Grid>
                        <Grid item>
                            <IconButton onClick={handleOffsetToNext} disabled={offsetToNextButtonDisabled}>
                                <NavigateNextIcon className={offsetToNextButtonDisabled ? '' : classes.button} />
                            </IconButton>
                        </Grid>
                    </>
                )}
            </GridContainer>
        </Fade>
    );
};

export default MobileVideoOverlay;
