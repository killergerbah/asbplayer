import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import TextField from '@material-ui/core/TextField';
import React, { useEffect, useState } from 'react';

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
            <DialogContent>
                <form>
                    <TextField
                        variant="filled"
                        color="secondary"
                        fullWidth
                        label="Video Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <div
                        style={{
                            display: showSubSelect ? 'block' : 'none',
                            marginTop: '20px',
                        }}
                    >
                        <InputLabel id="track-select-label">Subtitle Sync</InputLabel>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <Select
                                autoWidth
                                labelId="track-select-label"
                                label="Sync Subtitle Track"
                                value={selected}
                                onChange={(e) => setSelected(e.target.value)}
                                disabled={isLoading}
                            >
                                {subtitles.map((subtitle) => (
                                    <MenuItem value={subtitle.url} key={subtitle.url}>
                                        {subtitle.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            {isLoading && <CircularProgress size={20} />}
                        </div>
                    </div>
                    {error && <div style={{ color: '#ff1f62', marginTop: '20px' }}>Error occured: {error}</div>}
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
