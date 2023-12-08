import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/styles/makeStyles';
import Switch from '@material-ui/core/Switch';
import { LabelWithHoverEffect } from '@project/common/components/SettingsForm';
import { ConfirmedVideoDataSubtitleTrack, VideoDataSubtitleTrack } from '@project/common';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const createClasses = makeStyles((theme) => ({
    relative: {
        position: 'relative',
    },
    spinner: {
        position: 'absolute',
        right: 'calc(1em + 14px)',
        top: 'calc(50% - 13px)',
        fontSize: '1.5em',
    },
    hide: {
        display: 'none',
    },
}));

function calculateName(suggestedName: string, label: string) {
    if (suggestedName === '' && label) {
        return label;
    }

    if (label) {
        return `${suggestedName} - ${label}`;
    }

    return suggestedName;
}

interface Props {
    open: boolean;
    disabled: boolean;
    isLoading: boolean;
    suggestedName: string;
    showSubSelect: boolean;
    subtitles: VideoDataSubtitleTrack[];
    selectedSubtitle: string[];
    defaultCheckboxState: boolean;
    error: string;
    openedFromMiningCommand: boolean;
    onCancel: () => void;
    onOpenFile: () => void;
    onConfirm: (track: ConfirmedVideoDataSubtitleTrack[], shouldRememberTrackChoices: boolean) => void;
}

export default function VideoDataSyncDialog({
    open,
    disabled,
    isLoading,
    suggestedName,
    showSubSelect,
    subtitles,
    selectedSubtitle,
    defaultCheckboxState,
    error,
    openedFromMiningCommand,
    onCancel,
    onOpenFile,
    onConfirm,
}: Props) {
    const { t } = useTranslation();
    const [selectedSubtitles, setSelectedSubtitles] = useState(['-', '-', '-']);
    const [name, setName] = useState('');
    const [shouldRememberTrackChoices, setShouldRememberTrackChoices] = React.useState(false);
    const trimmedName = name.trim();
    const classes = createClasses();

    useEffect(() => {
        if (open) {
            setSelectedSubtitles(
                selectedSubtitle.map((url) => {
                    return url !== undefined ? url : '-';
                })
            );
        } else if (!open) {
            setName('');
        }
    }, [open, selectedSubtitle]);

    useEffect(() => {
        if (open) {
            setShouldRememberTrackChoices(defaultCheckboxState);
        }
    }, [open, defaultCheckboxState]);

    useEffect(() => {
        setName((name) => {
            if (!subtitles) {
                // Unable to calculate the video name
                return name;
            }

            // If the video name is not calculated yet,
            // or has already been calculated and not changed by the user,
            // then calculate it (possibly again)
            if (
                !name ||
                name === suggestedName ||
                subtitles.find((track) => track.url !== '-' && name === calculateName(suggestedName, track.label))
            ) {
                const selectedTrack = subtitles.find((track) => track.url === selectedSubtitles[0])!;

                if (selectedTrack.url === '-') {
                    return suggestedName;
                }

                return calculateName(suggestedName, selectedTrack.label);
            }

            // Otherwise, let the name be whatever the user set it to
            return name;
        });
    }, [suggestedName, selectedSubtitles, subtitles]);

    function handleOkButtonClick() {
        const selectedSubtitleTracks: ConfirmedVideoDataSubtitleTrack[] = allSelectedSubtitleTracks();
        onConfirm(selectedSubtitleTracks, shouldRememberTrackChoices);
    }

    function handleRememberTrackChoices() {
        setShouldRememberTrackChoices(!shouldRememberTrackChoices);
    }

    function allSelectedSubtitleTracks() {
        const selectedSubtitleTracks: ConfirmedVideoDataSubtitleTrack[] = selectedSubtitles
            .map((selected): ConfirmedVideoDataSubtitleTrack | undefined => {
                const subtitle = subtitles.find((subtitle) => subtitle.url === selected);
                if (subtitle) {
                    const { language, extension, m3U8BaseUrl } = subtitle;
                    return {
                        name: suggestedName.trim() + language.trim(),
                        extension: extension,
                        subtitleUrl: selected,
                        language: language,
                        m3U8BaseUrl: m3U8BaseUrl,
                    };
                }
            })
            .filter((track): track is ConfirmedVideoDataSubtitleTrack => track !== undefined);

        // Give the first track the trimmed name from the name field in case it has been changed by the user
        selectedSubtitleTracks[0].name = trimmedName;

        return selectedSubtitleTracks;
    }

    function generateSubtitleTrackSelectors(numberOfSubtitleTrackSelectors: number) {
        const subtitleTrackSelectors = [];
        for (let i = 0; i < numberOfSubtitleTrackSelectors; i++) {
            subtitleTrackSelectors.push(
                <Grid item key={i}>
                    <div className={`${classes.relative}${!showSubSelect ? ` ${classes.hide}` : ''}`}>
                        <TextField
                            select
                            fullWidth
                            key={i}
                            error={!!error}
                            color="secondary"
                            variant="filled"
                            label={`${t('extension.videoDataSync.subtitleTrack')} ${i + 1}`}
                            helperText={error || ''}
                            value={selectedSubtitles[i]}
                            disabled={isLoading || disabled}
                            onChange={(e) =>
                                setSelectedSubtitles((prevSelectedSubtitles) => {
                                    const newSelectedSubtitles = [...prevSelectedSubtitles];
                                    newSelectedSubtitles[i] = e.target.value;
                                    return newSelectedSubtitles;
                                })
                            }
                        >
                            {subtitles.map((subtitle) => (
                                <MenuItem value={subtitle.url} key={subtitle.url}>
                                    {subtitle.label}
                                </MenuItem>
                            ))}
                        </TextField>
                        {isLoading && (
                            <span className={classes.spinner}>
                                <CircularProgress size={20} color="secondary" />
                            </span>
                        )}
                    </div>
                </Grid>
            );
        }
        return subtitleTrackSelectors;
    }

    const threeSubtitleTrackSelectors = generateSubtitleTrackSelectors(3);

    return (
        <Dialog disableEnforceFocus fullWidth maxWidth="sm" open={open} onClose={onCancel}>
            <Toolbar>
                <Typography variant="h6" style={{ flexGrow: 1 }}>
                    {t('extension.videoDataSync.selectSubtitles')}
                </Typography>
                {onCancel && (
                    <IconButton edge="end" onClick={() => onCancel()}>
                        <CloseIcon />
                    </IconButton>
                )}
            </Toolbar>
            <DialogContent>
                {openedFromMiningCommand && (
                    <DialogContentText>{t('extension.videoDataSync.loadSubtitlesFirst')}</DialogContentText>
                )}
                <form>
                    <Grid container direction="column" spacing={2}>
                        <Grid item>
                            <TextField
                                fullWidth
                                multiline
                                color="secondary"
                                variant="filled"
                                label={t('extension.videoDataSync.videoName')}
                                value={name}
                                disabled={disabled}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </Grid>
                        {threeSubtitleTrackSelectors}
                        <Grid item>
                            <LabelWithHoverEffect
                                control={
                                    <Switch
                                        checked={shouldRememberTrackChoices}
                                        onChange={handleRememberTrackChoices}
                                        color="secondary"
                                    />
                                }
                                label={t('extension.videoDataSync.rememberTrackPreference')}
                                labelPlacement="start"
                                style={{
                                    justifyContent: 'end',
                                    width: '100%',
                                    flexDirection: 'row-reverse',
                                    marginLeft: '13px',
                                }}
                            />
                        </Grid>
                    </Grid>
                </form>
            </DialogContent>
            <DialogActions>
                <Button disabled={disabled} onClick={() => onOpenFile()}>
                    {t('action.openFiles')}
                </Button>
                <Button disabled={!trimmedName || disabled} onClick={handleOkButtonClick}>
                    {t('action.ok')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
