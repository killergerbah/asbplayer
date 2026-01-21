import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import MuiAlert from '@mui/material/Alert';
import {
    DictionaryTrack,
    TokenStatus,
    getFullyKnownTokenStatus,
    NUM_TOKEN_STATUSES,
    NUM_DICTIONARY_TRACKS,
    TokenState,
    ApplyStrategy,
    Profile,
} from '@project/common/settings';
import { Yomitan } from '../yomitan/yomitan';
import SwitchLabelWithHoverEffect from './SwitchLabelWithHoverEffect';
import SettingsTextField from './SettingsTextField';
import { DictionaryLocalTokenInput, DictionaryProvider, DictionaryTokenRecord } from '../dictionary-db';
import { ensureStoragePersisted, HAS_LETTER_REGEX } from '../util';

interface ImportClipboardToken {
    token: string;
    lemmas: string[];
}

interface Props {
    open: boolean;
    dictionaryTracks: DictionaryTrack[];
    selectedDictionaryTrack: number;
    dictionaryProvider: DictionaryProvider;
    activeProfile?: string;
    profiles: Profile[];
    onClose: () => void;
}

const DictionaryImport: React.FC<Props> = ({
    open,
    dictionaryTracks,
    selectedDictionaryTrack,
    dictionaryProvider,
    activeProfile,
    profiles,
    onClose,
}) => {
    const { t } = useTranslation();
    const [importClipboardTrack, setImportClipboardTrack] = useState<number>(selectedDictionaryTrack);
    const [importClipboardStatus, setImportClipboardStatus] = useState<TokenStatus>(getFullyKnownTokenStatus());
    const [importClipboardState, setImportClipboardState] = useState<TokenState | null>(null);
    const [importClipboardText, setImportClipboardText] = useState('');
    const [importClipboardPreview, setImportClipboardPreview] = useState<ImportClipboardToken[] | null>(null);
    const [importClipboardPreviewHasChanges, setImportClipboardPreviewHasChanges] = useState<boolean>();
    const [importClipboardLoading, setImportClipboardLoading] = useState(false);
    const [importClipboardError, setImportClipboardError] = useState<string>();

    useEffect(() => {
        setImportClipboardPreview(null);
        setImportClipboardError(undefined);
    }, [importClipboardTrack, importClipboardText]);

    useEffect(() => {
        if (!open) {
            return;
        }
        void ensureStoragePersisted();
        setImportClipboardText('');
        setImportClipboardPreview(null);
        setImportClipboardError(undefined);
    }, [open]);

    const handleCloseImportClipboardDialog = useCallback(() => {
        void ensureStoragePersisted();
        setImportClipboardText('');
        setImportClipboardPreview(null);
        setImportClipboardError(undefined);
        setImportClipboardLoading(false);
        onClose();
    }, [onClose]);

    const handlePreviewImportClipboard = useCallback(async () => {
        void ensureStoragePersisted();
        setImportClipboardLoading(true);
        setImportClipboardError(undefined);
        setImportClipboardPreview(null);
        try {
            const dt = dictionaryTracks[importClipboardTrack];
            const yomitan = new Yomitan(dt);

            const tokenSet = new Set<string>();
            for (const tokenParts of await yomitan.tokenize(importClipboardText)) {
                const token = tokenParts
                    .map((p) => p.text)
                    .join('')
                    .trim();
                if (!HAS_LETTER_REGEX.test(token)) continue;
                tokenSet.add(token);
            }

            const entries: ImportClipboardToken[] = [];
            for (const token of tokenSet) {
                const lemmas = await yomitan.lemmatize(token);
                entries.push({ token, lemmas });
            }
            if (!entries.length) setImportClipboardError(t('settings.dictionaryImportClipboardNoTokens'));
            setImportClipboardPreview(entries);
            setImportClipboardPreviewHasChanges(false);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setImportClipboardError(message);
            setImportClipboardPreview(null);
        } finally {
            setImportClipboardLoading(false);
        }
    }, [dictionaryTracks, importClipboardTrack, importClipboardText, t]);

    const handleSaveImportClipboard = useCallback(async () => {
        if (!importClipboardPreview?.length) return;
        setImportClipboardLoading(true);
        try {
            void ensureStoragePersisted();
            const inputs: DictionaryLocalTokenInput[] = importClipboardPreview.map((entry) => ({
                token: entry.token,
                status: importClipboardStatus,
                lemmas: entry.lemmas,
                states: importClipboardState !== null ? [importClipboardState] : [],
            }));
            await dictionaryProvider.saveRecordLocalBulk(activeProfile, inputs, ApplyStrategy.ADD);
            onClose();
            setImportClipboardPreview(null);
            setImportClipboardText('');
            setImportClipboardError(undefined);
        } catch (e) {
            setImportClipboardError(e instanceof Error ? e.message : String(e));
        } finally {
            setImportClipboardLoading(false);
        }
    }, [
        dictionaryProvider,
        activeProfile,
        importClipboardPreview,
        importClipboardStatus,
        importClipboardState,
        onClose,
    ]);

    const dictionaryDBFileInputRef = useRef<HTMLInputElement>(null);
    const tryImportFile = useCallback(
        async (file: File) => {
            let text: string;
            try {
                text = await file.text();
            } catch (e) {
                console.error(e);
                return;
            }

            // Assume exported JSON file in DictionaryTokenRecord format first
            let records: DictionaryTokenRecord[];

            try {
                records = JSON.parse(text);
            } catch (e) {
                // Was not JSON, assume arbitrary text
                setImportClipboardText(text);
                setImportClipboardPreviewHasChanges(true);
                return;
            }

            try {
                await dictionaryProvider.importRecordLocalBulk(
                    records,
                    profiles.map((p) => p.name)
                );
                onClose();
            } catch (e) {
                console.error(e);
            }
        },
        [dictionaryProvider, profiles, onClose]
    );
    const handleDictionaryDBFileInputChange = useCallback(async () => {
        const file = dictionaryDBFileInputRef.current?.files?.[0];
        if (file === undefined) return;
        try {
            tryImportFile(file);
        } catch (e) {
            console.error(e);
        } finally {
            if (dictionaryDBFileInputRef.current) {
                // Reset value to allow same file to be opened again
                dictionaryDBFileInputRef.current.value = '';
            }
        }
    }, [tryImportFile]);

    const handleImportDictionaryDB = useCallback(() => {
        void ensureStoragePersisted();
        dictionaryDBFileInputRef.current?.click();
    }, []);

    const isPreviewRequiredBeforeImport =
        importClipboardPreview === null || importClipboardPreview.length === 0 || importClipboardPreviewHasChanges;

    return (
        <>
            <Dialog open={open} onClose={handleCloseImportClipboardDialog} fullWidth maxWidth="sm">
                <DialogTitle>{t('action.importDictionaryLocalRecords')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} mt={1}>
                        <SettingsTextField
                            select
                            fullWidth
                            color="primary"
                            variant="outlined"
                            size="small"
                            label={t('settings.subtitleTrack')}
                            value={importClipboardTrack}
                            onChange={(e) => setImportClipboardTrack(Number(e.target.value))}
                        >
                            {[...Array(NUM_DICTIONARY_TRACKS).keys()].map((i) => (
                                <MenuItem key={i} value={i}>
                                    {t('settings.subtitleTrackChoice', { trackNumber: i + 1 })}
                                </MenuItem>
                            ))}
                        </SettingsTextField>
                        <SettingsTextField
                            select
                            fullWidth
                            color="primary"
                            variant="outlined"
                            size="small"
                            label={t('settings.dictionaryImportedMaturity')}
                            value={importClipboardStatus}
                            onChange={(e) => setImportClipboardStatus(Number(e.target.value) as TokenStatus)}
                        >
                            {[...Array(NUM_TOKEN_STATUSES).keys()].map((i) => {
                                const tokenStatusIndex = NUM_TOKEN_STATUSES - 1 - i;
                                return (
                                    <MenuItem key={tokenStatusIndex} value={tokenStatusIndex}>
                                        {t(`settings.dictionaryTokenStatus${tokenStatusIndex}`)}
                                    </MenuItem>
                                );
                            })}
                        </SettingsTextField>
                        <SwitchLabelWithHoverEffect
                            control={
                                <Switch
                                    checked={importClipboardState === TokenState.IGNORED}
                                    onChange={(e) =>
                                        setImportClipboardState(e.target.checked ? TokenState.IGNORED : null)
                                    }
                                />
                            }
                            label={t('settings.dictionaryImportClipboardIgnored')}
                            labelPlacement="start"
                        />
                        <TextField
                            multiline
                            minRows={8}
                            label={t('settings.dictionaryImportClipboardText')}
                            value={importClipboardText}
                            onChange={(e) => {
                                setImportClipboardText(e.target.value);
                                setImportClipboardPreviewHasChanges(true);
                            }}
                            fullWidth
                        />
                        {importClipboardError && <MuiAlert severity="error">{importClipboardError}</MuiAlert>}
                        {(importClipboardPreview?.length || undefined) && (
                            <List dense>
                                {importClipboardPreview!.map((entry) => (
                                    <ListItem key={entry.token} disableGutters>
                                        <ListItemText primary={entry.token} secondary={entry.lemmas.join(' · ')} />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseImportClipboardDialog}>{t('action.cancel')}</Button>
                    <Button onClick={handleImportDictionaryDB}>{t('action.importFile')}</Button>
                    {isPreviewRequiredBeforeImport && (
                        <Button
                            onClick={handlePreviewImportClipboard}
                            disabled={!importClipboardText.trim().length || importClipboardLoading}
                        >
                            {t('action.preview')}
                        </Button>
                    )}
                    {!isPreviewRequiredBeforeImport && (
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSaveImportClipboard}
                            disabled={!importClipboardPreview?.length || importClipboardLoading}
                        >
                            {t('action.save')}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
            <input
                ref={dictionaryDBFileInputRef}
                onChange={handleDictionaryDBFileInputChange}
                type="file"
                accept=".json,.txt"
                hidden
            />
        </>
    );
};

export default DictionaryImport;
