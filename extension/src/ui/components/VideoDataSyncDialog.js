import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Grid from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import { makeStyles } from '@material-ui/styles';
import React, { useEffect, useState } from 'react';

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

export default function VideoDataSyncDialog({
    open,
    isLoading,
    suggestedName,
    showSubSelect,
    subtitles,
    selectedSubtitle,
    error,
    onCancel,
    onConfirm,
}) {
    const [selected, setSelected] = useState('-');
    const [name, setName] = useState('');
    const trimmedName = name.trim();
    const classes = createClasses();

    useEffect(() => {
        if (open && !isLoading) {
            setSelected(selectedSubtitle);
            if (!trimmedName) setName(suggestedName);
        } else if (!open) {
            setName('');
        }
    }, [open, isLoading, suggestedName, selectedSubtitle]);

    return (
        <Dialog
            disableEnforceFocus
            fullWidth
            maxWidth="sm"
            open={open}
            onBackdropClick={onCancel}
            onEscapeKeyDown={onCancel}
        >
            <DialogTitle>Select Subtitles</DialogTitle>
            <DialogContent className={classes.content}>
                <form>
                    <Grid container direction="column" spacing={2}>
                        <Grid item>
                            <TextField
                                fullWidth
                                color="secondary"
                                variant="filled"
                                label="Video Name"
                                value={name}
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
                                    label="Subtitle Track"
                                    helperText={error || ''}
                                    value={selected}
                                    disabled={isLoading}
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
                <Button onClick={() => onCancel()}>Cancel</Button>
                <Button
                    disabled={!trimmedName}
                    onClick={() => {
                        const { language } = subtitles.find((subtitle) => subtitle.url === selected);
                        onConfirm({ name: trimmedName, subtitleUrl: selected, language });
                    }}
                >
                    Confirm
                </Button>
            </DialogActions>
        </Dialog>
    );
}
