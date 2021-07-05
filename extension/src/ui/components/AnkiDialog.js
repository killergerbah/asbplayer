import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { makeStyles } from '@material-ui/styles';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import IconButton from '@material-ui/core/IconButton';
import InputAdornment from '@material-ui/core/InputAdornment';
import SearchIcon from '@material-ui/icons/Search';
import SettingsIcon from '@material-ui/icons/Settings';
import Tooltip from '@material-ui/core/Tooltip';

const useStyles = makeStyles((theme) => ({
    root: {
        '& .MuiTextField-root': {
            marginBottom: theme.spacing(1),
        },
    },
    title: {
        flexGrow: 1
    },
    mediaField: {
        cursor: 'pointer',
        '& input': {
            cursor: 'pointer'
        }
    }
}));

export default function AnkiDialog({
    open,
    disabled,
    text: initialText,
    onProceed,
    onCancel,
    onViewImage,
    audioClip: initialAudioClip,
    image,
    source,
    settingsProvider,
    anki,
    mp3WorkerUrl
    }) {
    const classes = useStyles();
    const [definition, setDefinition] = useState("");
    const [text, setText] = useState();
    const [word, setWord] = useState();
    const [lastSearchedWord, setLastSearchedWord] = useState();
    const [duplicateNotes, setDuplicateNotes] = useState([]);
    const [wordTimestamp, setWordTimestamp] = useState(0);
    const [customFieldValues, setCustomFieldValues] = useState({});
    const audioClip = useMemo(() => {
        if (initialAudioClip && settingsProvider.preferMp3) {
            return initialAudioClip.toMp3(() => new Worker(mp3WorkerUrl));
        }

        return initialAudioClip;
    }, [initialAudioClip, settingsProvider.preferMp3])

    useEffect(() => {
        setText(initialText);
        setDefinition("");
        setWord("");
        setDuplicateNotes([]);
        setCustomFieldValues({});
    }, [initialText]);

    useEffect(() => {
        setWordTimestamp(Date.now());
    }, [word]);

    useEffect(() => {
        if (!word || !settingsProvider.wordField) {
            return;
        }

        const trimmedWord = word.trim();

        if (trimmedWord === "" || trimmedWord === lastSearchedWord) {
            return;
        }

        const timeout = setTimeout(async () => {
            try {
                setDuplicateNotes(await anki.findNotesWithWord(trimmedWord));
                setLastSearchedWord(trimmedWord);
            } catch (e) {
                console.error(e);
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [word, wordTimestamp, lastSearchedWord, anki, settingsProvider.wordField]);

    const handlePlayAudio = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        audioClip.play();
    }, [audioClip]);

    const handleCustomFieldChange = useCallback((customFieldName, value) => {
        const newCustomFieldValues = {};
        Object.assign(newCustomFieldValues, customFieldValues);
        newCustomFieldValues[customFieldName] = value;
        setCustomFieldValues(newCustomFieldValues);
    }, [customFieldValues]);

    let wordHelperText;

    if (word && word.trim() === lastSearchedWord && settingsProvider.wordField) {
        wordHelperText = duplicateNotes.length > 0
            ? `Found ${duplicateNotes.length} notes with word "${word}" in field "${settingsProvider.wordField}"`
            : `No notes found with word "${word.trim()}" in field "${settingsProvider.wordField}"`;
    } else {
        wordHelperText = "";
    }

    const handleViewImage = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        onViewImage(image);
    }, [image, onViewImage]);

    return (
        <Dialog
            open={open}
            disableEnforceFocus
            fullWidth
            maxWidth="sm"
            onBackdropClick={onCancel}
            onEscapeKeyDown={onCancel}
        >
            <DialogTitle>Anki Export</DialogTitle>
            <DialogContent>
                <form className={classes.root}>
                    <TextField
                        variant="filled"
                        color="secondary"
                        multiline
                        fullWidth
                        rowsMax={8}
                        label="Sentence"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <TextField
                        variant="filled"
                        color="secondary"
                        multiline
                        fullWidth
                        rows={8}
                        label="Definition"
                        value={definition}
                        onChange={(e) => setDefinition(e.target.value)}
                    />
                    <TextField
                        variant="filled"
                        color="secondary"
                        fullWidth
                        label="Word"
                        value={word}
                        onChange={(e) => setWord(e.target.value)}
                        helperText={wordHelperText}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                <Tooltip title="Search in Anki">
                                    <span>
                                    <IconButton
                                        disabled={disabled || !settingsProvider.wordField || !word || word.trim() === ""}
                                        onClick={() => anki.findNotesWithWordGui(word.trim())}
                                        edge="end"
                                    >
                                        <SearchIcon />
                                    </IconButton>
                                    </span>
                                </Tooltip>
                                </InputAdornment>
                            )
                        }}
                    />
                    {Object.keys(settingsProvider.customAnkiFields).map((customFieldName) => (
                        <TextField
                            key={customFieldName}
                            variant="filled"
                            color="secondary"
                            fullWidth
                            label={customFieldName}
                            value={customFieldValues[customFieldName] || ""}
                            onChange={(e) => handleCustomFieldChange(customFieldName, e.target.value)}
                        />
                    ))}
                    {audioClip && (
                        <div
                            className={classes.mediaField}
                            onClick={handlePlayAudio}
                        >
                            <TextField
                                variant="filled"
                                color="secondary"
                                fullWidth
                                value={audioClip.name}
                                label="Audio"
                            />
                        </div>
                    )}
                    {image && (
                        <div
                            className={classes.mediaField}
                            onClick={handleViewImage}
                        >
                            <TextField
                                variant="filled"
                                color="secondary"
                                fullWidth
                                value={image.name}
                                label="Image"
                            />
                        </div>
                    )}
                    <TextField
                        variant="filled"
                        color="secondary"
                        fullWidth
                        label="Source"
                        value={source}
                    />
                </form>
            </DialogContent>
            <DialogActions>
                <Button
                    disabled={disabled}
                    onClick={() => onCancel()}>
                    Cancel
                </Button>
                <Button
                    disabled={disabled}
                    onClick={() => onProceed(text, definition, audioClip, image, word, source, customFieldValues, 'gui')}
                >
                    Open in Anki
                </Button>
                <Button
                    disabled={disabled}
                    onClick={() => onProceed(text, definition, audioClip, image, word, source, customFieldValues, 'updateLast')}
                >
                    Update Last Card
                </Button>
                <Button
                    disabled={disabled}
                    onClick={() => onProceed(text, definition, audioClip, image, word, source, customFieldValues, 'default')}
                >
                    Export
                </Button>
            </DialogActions>
        </Dialog>
    );
}