import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Grid from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
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
    onConfirm: (track: ConfirmedVideoDataSubtitleTrack) => void;
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
    const [selected, setSelected] = useState('-');
    const [name, setName] = useState('');
    const trimmedName = name.trim();
    const classes = createClasses();

    useEffect(() => {
        if (open) {
            setSelected(selectedSubtitle);
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
                const selectedTrack = subtitles.find((track) => track.url === selected)!;

                if (selectedTrack.url === '-') {
                    return suggestedName;
                }

                return calculateName(suggestedName, selectedTrack.label);
            }

            // Otherwise, let the name be whatever the user set it to
            return name;
        });
    }, [suggestedName, selected, subtitles]);

    return (
        <Dialog disableEnforceFocus fullWidth maxWidth="sm" open={open} onClose={onCancel}>
            <DialogTitle>{t('extension.videoDataSync.selectSubtitles')}</DialogTitle>
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
                        <Grid item>
                            <div className={`${classes.relative}${!showSubSelect ? ` ${classes.hide}` : ''}`}>
                                <TextField
                                    select
                                    fullWidth
                                    error={!!error}
                                    color="secondary"
                                    variant="filled"
                                    label={t('extension.videoDataSync.subtitleTrack')}
                                    helperText={error || ''}
                                    value={selected}
                                    disabled={isLoading || disabled}
                                    onChange={(e) => setSelected(e.target.value)}
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
                    </Grid>
                </form>
            </DialogContent>
            <DialogActions>
                <Button disabled={disabled} onClick={() => onCancel()}>
                    {t('action.cancel')}
                </Button>
                <Button disabled={disabled} onClick={() => onOpenFile()}>
                    {t('action.openFiles')}
                </Button>
                <Button
                    disabled={!trimmedName || disabled}
                    onClick={() => {
                        const { language, extension, m3U8BaseUrl } = subtitles.find(
                            (subtitle) => subtitle.url === selected
                        )!;
                        onConfirm({
                            name: trimmedName,
                            extension: extension,
                            subtitleUrl: selected,
                            language,
                            m3U8BaseUrl: m3U8BaseUrl,
                        });
                    }}
                >
                    {t('action.ok')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
