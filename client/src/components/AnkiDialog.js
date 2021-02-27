import { useState, useEffect } from 'react';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';

export default function AnkiDialog(props) {
    const {open, disabled, text, onProceed, onCancel} = props;
    const [definition, setDefinition] = useState("");

    useEffect(() => {
        setDefinition("");
    }, [open])

    return (
        <Dialog
            open={open}
            disableEnforceFocus
            fullWidth
            maxWidth="sm"
        >
            <DialogTitle>Anki Export</DialogTitle>
            <DialogContent>
                <DialogContentText color="textPrimary">
                    {text}
                </DialogContentText>
                <TextField
                    variant="filled"
                    multiline
                    fullWidth
                    rows={8}
                    label="Definition"
                    value={definition}
                    onChange={(e) => setDefinition(e.target.value)}
                />
            </DialogContent>
            <DialogActions>
                <Button
                    disabled={disabled}
                    onClick={() => onCancel()}>
                    Cancel
                </Button>
                <Button
                    disabled={disabled || !definition}
                    onClick={() => onProceed(definition)}
                >
                    Export
                </Button>
            </DialogActions>
        </Dialog>
    );
}