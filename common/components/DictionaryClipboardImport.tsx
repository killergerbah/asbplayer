import React, { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import IconButton from '@mui/material/IconButton';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
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
} from '@project/common/settings';
import { Yomitan } from '../yomitan/yomitan';
import SwitchLabelWithHoverEffect from './SwitchLabelWithHoverEffect';
import SettingsTextField from './SettingsTextField';
import { DictionaryLocalTokenInput, DictionaryProvider, DictionaryTokenKey } from '../dictionary-db';
import { ensureStoragePersisted, HAS_LETTER_REGEX } from '../util';

interface ImportClipboardToken {
    token: string;
    lemmas: string[];
}

interface Props {
    dictionaryTracks: DictionaryTrack[];
    selectedDictionaryTrack: number;
    dictionaryProvider: DictionaryProvider;
    activeProfile?: string;
}

const DictionaryClipboardImport: React.FC<Props> = ({
    dictionaryTracks,
    selectedDictionaryTrack,
    dictionaryProvider,
    activeProfile,
}) => {
    const { t } = useTranslation();
    const [importClipboardDialogOpen, setImportClipboardDialogOpen] = useState(false);
    const [importClipboardTrack, setImportClipboardTrack] = useState<number>(selectedDictionaryTrack);
    const [importClipboardStatus, setImportClipboardStatus] = useState<TokenStatus>(getFullyKnownTokenStatus());
    const [importClipboardState, setImportClipboardState] = useState<TokenState | null>(null);
    const [importClipboardText, setImportClipboardText] = useState('');
    const [importClipboardPreview, setImportClipboardPreview] = useState<ImportClipboardToken[] | null>(null);
    const [importClipboardLoading, setImportClipboardLoading] = useState(false);
    const [importClipboardError, setImportClipboardError] = useState<string>();

    useEffect(() => {
        setImportClipboardPreview(null);
        setImportClipboardError(undefined);
    }, [importClipboardTrack, importClipboardText]);

    const handleOpenImportClipboardDialog = useCallback(() => {
        void ensureStoragePersisted();
        setImportClipboardDialogOpen(true);
        setImportClipboardText('');
        setImportClipboardPreview(null);
        setImportClipboardError(undefined);
    }, []);

    const handleCloseImportClipboardDialog = useCallback(() => {
        void ensureStoragePersisted();
        setImportClipboardDialogOpen(false);
        setImportClipboardText('');
        setImportClipboardPreview(null);
        setImportClipboardError(undefined);
        setImportClipboardLoading(false);
    }, []);

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
            setImportClipboardDialogOpen(false);
            setImportClipboardPreview(null);
            setImportClipboardText('');
            setImportClipboardError(undefined);
        } catch (e) {
            setImportClipboardError(e instanceof Error ? e.message : String(e));
        } finally {
            setImportClipboardLoading(false);
        }
    }, [dictionaryProvider, activeProfile, importClipboardPreview, importClipboardStatus, importClipboardState]);

    return (
        <>
            <IconButton onClick={handleOpenImportClipboardDialog} size="small">
                <ContentPasteIcon fontSize="small" />
            </IconButton>
            <Dialog open={importClipboardDialogOpen} onClose={handleCloseImportClipboardDialog} fullWidth maxWidth="sm">
                <DialogTitle>{t('settings.dictionaryImportClipboardTitle')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} mt={1}>
                        <SettingsTextField
                            select
                            fullWidth
                            color="primary"
                            variant="outlined"
                            size="small"
                            label={t('settings.title')}
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
                            onChange={(e) => setImportClipboardText(e.target.value)}
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
                    <Button
                        onClick={handlePreviewImportClipboard}
                        disabled={!importClipboardText.trim().length || importClipboardLoading}
                    >
                        {t('action.preview')}
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSaveImportClipboard}
                        disabled={!importClipboardPreview?.length || importClipboardLoading}
                    >
                        {t('action.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default DictionaryClipboardImport;
