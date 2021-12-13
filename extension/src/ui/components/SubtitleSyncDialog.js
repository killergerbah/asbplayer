import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import React, { useEffect, useState } from 'react';

export default function SubtitleRetrievalDialog({ open, tracks, initial, onCancel, onConfirm }) {
    const [selected, setSelected] = useState('');

    useEffect(() => {
        if (tracks.length) {
            setSelected(initial || tracks[0].url);
        }
    }, [initial]);

    const handleChange = (event) => {
        setSelected(event.target.value);
    };

    return (
        <Dialog open={open} onBackdropClick={onCancel} onEscapeKeyDown={onCancel}>
            <DialogTitle>Select a Subtitle</DialogTitle>
            <DialogContent>
                <form>
                    <InputLabel id="track-select-label">Track</InputLabel>
                    <Select
                        autoWidth
                        labelId="track-select-label"
                        label="Track"
                        value={selected}
                        onChange={handleChange}
                    >
                        {tracks.map((track) => (
                            <MenuItem value={track.url} key={track.url}>
                                {track.label}
                            </MenuItem>
                        ))}
                    </Select>
                </form>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onCancel()}>Cancel</Button>
                <Button onClick={() => onConfirm(selected)}>Confirm</Button>
            </DialogActions>
        </Dialog>
    );
}
