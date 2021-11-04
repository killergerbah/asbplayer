import React, { useState, useEffect } from 'react';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';

export default function VideoNameDialog({ open, onNameSet, onCancel }) {
    const [name, setName] = useState('');
    const trimmedName = name.trim();

    useEffect(() => {
        setName('');
    }, [open]);

    return (
        <Dialog
            open={open}
            disableEnforceFocus
            fullWidth
            maxWidth="sm"
            onBackdropClick={onCancel}
            onEscapeKeyDown={onCancel}
        >
            <DialogTitle>Set Video Name</DialogTitle>
            <DialogContent>
                <TextField
                    variant="filled"
                    color="secondary"
                    fullWidth
                    label="Video Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onCancel()}>Cancel</Button>
                <Button disabled={trimmedName === ''} onClick={() => onNameSet(trimmedName)}>
                    OK
                </Button>
            </DialogActions>
        </Dialog>
    );
}
