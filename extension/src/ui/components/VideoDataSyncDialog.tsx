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
    selectedSubtitle: string;
    error: string;
    openedFromMiningCommand: boolean;
    onCancel: () => void;
    onOpenFile: () => void;
    onConfirm: (track: ConfirmedVideoDataSubtitleTrack[]) => void;
}

export default function VideoDataSyncDialog({
    open,
    disabled,
    isLoading,
    suggestedName,
    showSubSelect,
    subtitles,
    selectedSubtitle,
    error,
    openedFromMiningCommand,
    onCancel,
    onOpenFile,
    onConfirm,
}: Props) {
    const { t } = useTranslation();
    const [selectedSubtitles, setSelectedSubtitles] = useState(['-', '-', '-']);
    const [name, setName] = useState('');
    const trimmedName = name.trim();
    const classes = createClasses();

    useEffect(() => {
        if (open) {
            setSelectedSubtitles(prevSelectedSubtitles => {
                const newSelectedSubtitles = [...prevSelectedSubtitles];
                newSelectedSubtitles[0] = selectedSubtitle;
                return newSelectedSubtitles;
            });
        } else if (!open) {
            setName('');
        }
    }, [open, selectedSubtitle]);

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
    }, [suggestedName, selectedSubtitles[0], subtitles]);

    function handleOkButtonClick() {
        const selectedSubtitleTracks: ConfirmedVideoDataSubtitleTrack[] = allSelectedSubtitleTracks();

        // Remove all but one empty track in order to intentionally send one empty track if no tracks are selected
        const uniqueTracks: ConfirmedVideoDataSubtitleTrack[] = filterByUniqueUrl(selectedSubtitleTracks);

        // If track length > 1 and we have unique tracks, then at least one language must have been selected and it is safe to remove the remaining empty track
        uniqueTracks.length > 1 ? onConfirm(removeEmptyTracks(uniqueTracks)) : onConfirm(uniqueTracks);
    }

    function allSelectedSubtitleTracks() {
        const selectedSubtitleTracks: ConfirmedVideoDataSubtitleTrack[] = selectedSubtitles.map((selected): ConfirmedVideoDataSubtitleTrack | undefined=> {
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

        return selectedSubtitleTracks
    }

    function filterByUniqueUrl(track: ConfirmedVideoDataSubtitleTrack[]) {
        const uniqueTracks: ConfirmedVideoDataSubtitleTrack[] = [];
        const urls: string[] = [];
        for (let i = 0; i < track.length; i++) {
            if (!urls.includes(track[i].subtitleUrl)) {
                uniqueTracks.push(track[i]);
                urls.push(track[i].subtitleUrl);
            }
        }

        return uniqueTracks;
    }

    function removeEmptyTracks(track: ConfirmedVideoDataSubtitleTrack[]) {
        return track.filter((track) => track.subtitleUrl !== '-')
    }

    function generateSubtitleTrackSelectors(numberOfSubtitleTrackSelectors : number) {
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
                        onChange={(e) => setSelectedSubtitles((prevSelectedSubtitles) => {
                            const newSelectedSubtitles = [...prevSelectedSubtitles];
                            newSelectedSubtitles[i] = e.target.value;
                            return newSelectedSubtitles;
                        })}
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
                    </Grid>
                </form>
            </DialogContent>
            <DialogActions>
                <Button disabled={disabled} onClick={() => onOpenFile()}>
                    {t('action.openFiles')}
                </Button>
                <Button
                    disabled={!trimmedName || disabled}
                    onClick={handleOkButtonClick}
                >
                    {t('action.ok')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
