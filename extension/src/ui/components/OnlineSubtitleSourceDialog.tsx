import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { JimakuClient } from '@/services/subtitle-sources';

interface OnlineSubtitleImportCandidate {
    name: string;
    url: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    onImport: (file: OnlineSubtitleImportCandidate) => Promise<void>;
    detectedTitleHint?: string;
    jimakuApiKey: string;
    onJimakuApiKeyChange: (jimakuApiKey: string) => void;
}

const emptyStateText = {
    entries: 'No entries',
    files: 'No files',
};

const SUPPORTED_JIMAKU_EXTENSIONS = ['.srt', '.ass'];

const isSupportedSubtitleFile = (name: string) =>
    SUPPORTED_JIMAKU_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

const normalizeDetectedTitleHint = (hint?: string) => {
    const trimmedHint = hint?.trim() ?? '';

    if (trimmedHint.length === 0) {
        return '';
    }

    const suffixSplit = trimmedHint.split(' - ');
    if (suffixSplit.length > 1) {
        return suffixSplit[0].trim();
    }

    return trimmedHint;
};

export default function OnlineSubtitleSourceDialog({
    open,
    onClose,
    onImport,
    detectedTitleHint,
    jimakuApiKey,
    onJimakuApiKeyChange,
}: Props) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    const [query, setQuery] = useState('');
    const [jimakuEntries, setJimakuEntries] = useState<{ id: number; name: string }[]>([]);
    const [jimakuSelectedEntryId, setJimakuSelectedEntryId] = useState<number>();
    const [jimakuFiles, setJimakuFiles] = useState<OnlineSubtitleImportCandidate[]>([]);

    const selectedFiles = jimakuFiles;
    const normalizedDetectedTitleHint = useMemo(
        () => normalizeDetectedTitleHint(detectedTitleHint),
        [detectedTitleHint]
    );
    const showDetectedTitleHint =
        normalizedDetectedTitleHint.length > 0 &&
        normalizedDetectedTitleHint.toLowerCase() !== query.trim().toLowerCase();
    const isSearchDisabled =
        loading || query.trim().length === 0 || jimakuApiKey.trim().length === 0;

    const resetState = useCallback(() => {
        setLoading(false);
        setError(undefined);
        setJimakuEntries([]);
        setJimakuSelectedEntryId(undefined);
        setJimakuFiles([]);
    }, []);

    useEffect(() => {
        if (open) {
            resetState();
        }
    }, [open, resetState]);

    const handleSearchJimaku = useCallback(async () => {
        setError(undefined);
        setLoading(true);

        try {
            const client = new JimakuClient({ apiKey: jimakuApiKey });
            const entries = (await client.searchEntries(query)).data;
            setJimakuEntries(entries.map((entry) => ({ id: entry.id, name: entry.name })));
            setJimakuSelectedEntryId(undefined);
            setJimakuFiles([]);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [jimakuApiKey, query]);

    const handleLoadJimakuFiles = useCallback(
        async (entryId: number) => {
            setError(undefined);
            setLoading(true);
            setJimakuSelectedEntryId(entryId);

            try {
                const client = new JimakuClient({ apiKey: jimakuApiKey });
                const files = (await client.getFiles(entryId)).data
                    .filter((file) => isSupportedSubtitleFile(file.name))
                    .map((file) => ({ name: file.name, url: file.url }));
                setJimakuFiles(files);
            } catch (e) {
                setError((e as Error).message);
                setJimakuFiles([]);
            } finally {
                setLoading(false);
            }
        },
        [jimakuApiKey]
    );

    const handleImport = useCallback(
        async (file: OnlineSubtitleImportCandidate) => {
            setError(undefined);
            setLoading(true);

            try {
                await onImport(file);
                onClose();
            } catch (e) {
                setError((e as Error).message);
            } finally {
                setLoading(false);
            }
        },
        [onClose, onImport]
    );

    const handleApplyDetectedTitleHint = useCallback(() => {
        setQuery(normalizedDetectedTitleHint);
    }, [normalizedDetectedTitleHint]);

    const handleSearch = handleSearchJimaku;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"

        >
            <DialogTitle>
                {t('extension.videoDataSync.onlineSubtitleSources', { defaultValue: 'Online subtitle sources' })}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2}>
                    {error && <Alert severity="error">{error}</Alert>}

                    {showDetectedTitleHint && (
                        <Alert
                            severity="info"
                            action={
                                <Button onClick={handleApplyDetectedTitleHint} size="small">
                                    {t('extension.videoDataSync.fillDetectedTitle', {
                                        defaultValue: 'Use title',
                                    })}
                                </Button>
                            }
                        >
                            {t('extension.videoDataSync.detectedTitleHint', {
                                defaultValue: 'Detected from current page: {{title}}',
                                title: normalizedDetectedTitleHint,
                            })}
                        </Alert>
                    )}

                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                            label={t('extension.videoDataSync.animeTitle', { defaultValue: 'Anime title' })}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            fullWidth
                        />
                        <Button variant="contained" onClick={handleSearch} disabled={isSearchDisabled}>
                            {t('extension.videoDataSync.search', { defaultValue: 'Search' })}
                        </Button>
                    </Box>

                    <TextField
                        label={t('extension.videoDataSync.jimakuApiKey', { defaultValue: 'Jimaku API Key' })}
                        value={jimakuApiKey}
                        onChange={(e) => onJimakuApiKeyChange(e.target.value)}
                        helperText={
                            <>
                                {t('extension.videoDataSync.jimakuApiKeyAutosaveHint', {
                                    defaultValue: 'Saved automatically after typing.',
                                })}
                                {' '}
                                <Link
                                    href="https://jimaku.cc/account"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    underline="hover"
                                >
                                    {t('extension.videoDataSync.jimakuApiKeyGetHere', {
                                        defaultValue: 'Get your API key here.',
                                    })}
                                </Link>
                            </>
                        }
                        fullWidth
                    />

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2">
                                {t('extension.videoDataSync.entries', { defaultValue: 'Entries' })}
                            </Typography>
                            <List
                                dense
                                sx={{ maxHeight: 220, overflow: 'auto', border: '1px solid', borderColor: 'divider' }}
                            >
                                {jimakuEntries.map((entry) => (
                                    <ListItemButton
                                        key={entry.id}
                                        onClick={() => handleLoadJimakuFiles(entry.id)}
                                        selected={jimakuSelectedEntryId === entry.id}
                                    >
                                        <ListItemText primary={entry.name} />
                                    </ListItemButton>
                                ))}
                                {jimakuEntries.length === 0 && (
                                    <ListItem>
                                        <ListItemText
                                            primary={t('extension.videoDataSync.noEntries', {
                                                defaultValue: emptyStateText.entries,
                                            })}
                                        />
                                    </ListItem>
                                )}
                            </List>
                        </Stack>

                        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2">
                                {t('extension.videoDataSync.availableFiles', { defaultValue: 'Available files' })}
                            </Typography>
                            <List dense sx={{ maxHeight: 220, overflow: 'auto', border: '1px solid', borderColor: 'divider' }}>
                                {selectedFiles.map((file) => (
                                    <ListItemButton key={file.url} onClick={() => handleImport(file)}>
                                        <ListItemText primary={file.name} secondary={file.url} />
                                    </ListItemButton>
                                ))}
                                {selectedFiles.length === 0 && (
                                    <ListItem>
                                        <ListItemText
                                            primary={t('extension.videoDataSync.noFiles', { defaultValue: emptyStateText.files })}
                                        />
                                    </ListItem>
                                )}
                            </List>
                        </Stack>
                    </Box>
                    {loading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                            <CircularProgress size={22} />
                        </Box>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('action.cancel')}</Button>
            </DialogActions>
        </Dialog>
    );
}
