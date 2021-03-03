import { useCallback, useState, useEffect } from 'react';
import { makeStyles } from '@material-ui/styles';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import TextField from '@material-ui/core/TextField';

const useStyles = makeStyles((theme) => ({
    root: {
        '& .MuiTextField-root': {
            margin: theme.spacing(1),
        },
    },
}));

const useSelectableSettingStyles = makeStyles((theme) => ({
    formControl: {
        margin: theme.spacing(1),
        minWidth: 120,
    },
}));

function SelectableSetting(props) {
    const classes = useSelectableSettingStyles();
    const {label, value, selections, onChange, onSelectionChange} = props;

    return (
        <div>
            <TextField
                label={label}
                value={value}
                onChange={onChange}
            />
            <FormControl className={classes.formControl}>
                <InputLabel></InputLabel>
                <Select
                    value={value}
                    disabled={!selections}
                    onChange={onSelectionChange}
                >
                    {selections && selections.map(s => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                </Select>
            </FormControl>
        </div>
    );
}

export default function SettingsDialog(props) {
    const {anki, open, settings, onClose} = props;
    const classes = useStyles();
    const [ankiConnectUrl, setAnkiConnectUrl] = useState(settings.ankiConnectUrl);
    const [ankiConnectUrlError, setAnkiConnectUrlError] = useState();
    const [ankiConnectUrlChangeTimestamp, setAnkiConnectUrlChangeTimestamp] = useState(0);
    const [deck, setDeck] = useState(settings.deck || "");
    const [deckNames, setDeckNames] = useState();
    const [noteType, setNoteType] = useState(settings.noteType || "");
    const [modelNames, setModelNames] = useState();
    const [sentenceField, setSentenceField] = useState(settings.sentenceField || "");
    const [definitionField, setDefinitionField] = useState(settings.definitionField || "");
    const [audioField, setAudioField] = useState(settings.audioField || "");
    const [fieldNames, setFieldNames] = useState();

    const handleAnkiConnectUrlChange = useCallback((e) => {
        setAnkiConnectUrl(e.target.value);
        setAnkiConnectUrlChangeTimestamp(Date.now());
    }, []);

    const handleDeckSelectionChange = useCallback((e) => setDeck(e.target.value), []);
    const handleDeckChange = useCallback((e) => setDeck(e.target.value), []);
    const handleNoteTypeSelectionChange = useCallback((e) => setNoteType(e.target.value), []);
    const handleNoteTypeChange = useCallback((e) => setNoteType(e.target.value), []);
    const handleSentenceFieldChange = useCallback((e) => setSentenceField(e.target.value), []);
    const handleSentenceFieldSelectionChange = useCallback((e) => setSentenceField(e.target.value), []);
    const handleDefinitionFieldChange = useCallback((e) => setDefinitionField(e.target.value), []);
    const handleDefinitionFieldSelectionChange = useCallback((e) => setDefinitionField(e.target.value), []);
    const handleAudioFieldChange = useCallback((e) => setAudioField(e.target.value), []);
    const handleAudioFieldSelectionChange = useCallback((e) => setAudioField(e.target.value), []);

    useEffect(() => {
        const timeout = setTimeout(async () => {
            try {
                setDeckNames(await anki.deckNames(ankiConnectUrl));
                setModelNames(await anki.modelNames(ankiConnectUrl));
                setAnkiConnectUrlError(null);
            } catch (e) {
                console.error(e);
                setDeckNames(null);
                setAnkiConnectUrlError(e.message);
            }
        }, 1000);

        return () => clearTimeout(timeout);
    }, [anki, ankiConnectUrl, ankiConnectUrlChangeTimestamp]);

    useEffect(() => {
        if (!noteType) {
            return;
        }

        async function refreshFieldNames() {
            try {
                setFieldNames(await anki.modelFieldNames(ankiConnectUrl, noteType));
                setAnkiConnectUrlError(null);
            } catch (e) {
                console.error(e);
                setFieldNames(null);
                setAnkiConnectUrlError(e.message);
            }
        }

        refreshFieldNames();
    }, [anki, noteType, ankiConnectUrl, ankiConnectUrlChangeTimestamp]);

    const handleClose = useCallback(() => {
        onClose({
            ankiConnectUrl: ankiConnectUrl,
            deck: deck,
            noteType: noteType,
            sentenceField: sentenceField,
            definitionField: definitionField,
            audioField: audioField
        });
    }, [onClose, ankiConnectUrl, deck, noteType, sentenceField, definitionField, audioField]);

    return (
        <Dialog
            open={open}
            maxWidth="xs"
            onBackdropClick={handleClose}
        >
            <DialogTitle>
                Settings
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Ensure that {window.location.protocol + "//" + window.location.hostname} is in the webCorsOriginList in your AnkiConnect settings.
                </DialogContentText>
                <form className={classes.root}>
                    <div>
                        <TextField
                            label="Anki Connect URL"
                            value={ankiConnectUrl}
                            error={Boolean(ankiConnectUrlError)}
                            helperText={ankiConnectUrlError}
                            onChange={handleAnkiConnectUrlChange}
                        />
                    </div>
                    <SelectableSetting
                        label="Deck"
                        value={deck}
                        selections={deckNames}
                        onChange={handleDeckChange}
                        onSelectionChange={handleDeckSelectionChange}
                    />
                    <SelectableSetting
                        label="Note Type"
                        value={noteType}
                        selections={modelNames}
                        onChange={handleNoteTypeChange}
                        onSelectionChange={handleNoteTypeSelectionChange}
                    />
                    <SelectableSetting
                        label="Sentence Field"
                        value={sentenceField}
                        selections={fieldNames}
                        onChange={handleSentenceFieldChange}
                        onSelectionChange={handleSentenceFieldSelectionChange}
                    />
                    <SelectableSetting
                        label="Definition Field"
                        value={definitionField}
                        selections={fieldNames}
                        onChange={handleDefinitionFieldChange}
                        onSelectionChange={handleDefinitionFieldSelectionChange}
                    />
                    <SelectableSetting
                        label="Audio Field"
                        value={audioField}
                        selections={fieldNames}
                        onChange={handleAudioFieldChange}
                        onSelectionChange={handleAudioFieldSelectionChange}
                    />
                </form>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>OK</Button>
            </DialogActions>
        </Dialog>
    )
}