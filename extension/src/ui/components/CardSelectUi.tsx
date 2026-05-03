import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AnkiDialogSettings,
    CardModel,
    CardUpdatedDialogMessage,
    Image,
    Message,
    UpdateStateMessage,
} from '@project/common';
import { AudioClip } from '@project/common/audio-clip';
import { createTheme } from '@project/common/theme';
import { extractText, sourceString } from '@project/common/util';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import { StyledEngineProvider } from '@mui/material/styles';
import Bridge from '../bridge';
import { BridgeFetcher } from '../bridge-fetcher';
import { Anki, NoteInfo } from '@project/common/anki';
import { CardSelectUiState } from '../../controllers/card-select-controller';
import { useTranslation } from 'react-i18next';
import type { PaletteMode } from '@mui/material/styles';

const MULTI_SELECT_KEY = 'cardSelectMultiSelect';

interface Props {
    bridge: Bridge;
}

export default function CardSelectUi({ bridge }: Props) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [settings, setSettings] = useState<AnkiDialogSettings>();
    const [card, setCard] = useState<CardModel>();
    const [notes, setNotes] = useState<NoteInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string>();
    const [search, setSearch] = useState('');
    const [multiSelect, setMultiSelect] = useState(() => localStorage.getItem(MULTI_SELECT_KEY) === 'true');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const theme = useMemo(() => createTheme((settings?.themeType ?? 'dark') as PaletteMode), [settings?.themeType]);
    const anki = useMemo(
        () => (settings ? new Anki(settings, new BridgeFetcher(bridge)) : undefined),
        [settings, bridge]
    );

    useEffect(() => {
        return bridge.addClientMessageListener((message: Message) => {
            if (message.command !== 'updateState') {
                return;
            }

            const state = (message as UpdateStateMessage).state as CardSelectUiState;
            setSettings(state.settings);
            setCard(state.card);
            setOpen(state.open);
            setSearch('');
            setError(undefined);
            setNotes([]);
            setSelectedIds(new Set());
        });
    }, [bridge]);

    useEffect(() => bridge.serverIsReady(), [bridge]);

    useEffect(() => {
        if (!open || !anki) {
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(undefined);

        anki.findNotes('added:30')
            .then((noteIds) => {
                if (cancelled) return;
                const sorted = [...noteIds].sort((a, b) => b - a).slice(0, 50);
                return anki.notesInfo(sorted);
            })
            .then((infos) => {
                if (cancelled || !infos) return;
                setNotes(infos);
            })
            .catch((e) => {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : String(e));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, anki]);

    const buildExportParams = useCallback(
        (noteId: number) => {
            if (!anki || !card || !settings) return undefined;
            const src = sourceString(card.subtitleFileName, card.mediaTimestamp);
            const audioClip =
                card.audio === undefined
                    ? undefined
                    : AudioClip.fromBase64(
                          src,
                          card.subtitle.start,
                          card.subtitle.end,
                          card.audio.playbackRate ?? 1,
                          card.audio.base64,
                          card.audio.extension,
                          card.audio.error
                      );
            const image =
                card.image === undefined
                    ? undefined
                    : Image.fromBase64(
                          src,
                          card.subtitle.start,
                          card.image.base64,
                          card.image.extension,
                          card.image.error
                      );
            return {
                text: card.text ?? extractText(card.subtitle, card.surroundingSubtitles),
                track1: extractText(card.subtitle, card.surroundingSubtitles, 0),
                track2: extractText(card.subtitle, card.surroundingSubtitles, 1),
                track3: extractText(card.subtitle, card.surroundingSubtitles, 2),
                definition: card.definition,
                audioClip,
                image,
                word: card.word,
                source: src,
                url: card.url,
                customFieldValues: card.customFieldValues ?? {},
                tags: settings.tags,
                mode: 'updateSpecific' as const,
                noteId,
            };
        },
        [anki, card, settings]
    );

    const finish = useCallback(() => {
        bridge.sendMessageFromServer({ command: 'card-updated-dialog' } as CardUpdatedDialogMessage);
        setOpen(false);
        bridge.sendMessageFromServer({ command: 'resume' });
    }, [bridge]);

    const handleSelect = useCallback(
        async (noteId: number) => {
            if (!anki) return;
            setUpdating(true);
            setError(undefined);
            try {
                const params = buildExportParams(noteId);
                if (params) await anki.export(params);
                finish();
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
            } finally {
                setUpdating(false);
            }
        },
        [anki, buildExportParams, finish]
    );

    const handleApply = useCallback(async () => {
        if (!anki || selectedIds.size === 0) return;
        setUpdating(true);
        setError(undefined);
        try {
            for (const noteId of selectedIds) {
                const params = buildExportParams(noteId);
                if (params) await anki.export(params);
            }
            finish();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setUpdating(false);
        }
    }, [anki, selectedIds, buildExportParams, finish]);

    const handleCancel = useCallback(() => {
        setOpen(false);
        bridge.sendMessageFromServer({ command: 'resume' });
    }, [bridge]);

    const handleMultiSelectChange = useCallback((checked: boolean) => {
        setMultiSelect(checked);
        localStorage.setItem(MULTI_SELECT_KEY, String(checked));
        setSelectedIds(new Set());
    }, []);

    const handleToggleId = useCallback((noteId: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(noteId)) next.delete(noteId);
            else next.add(noteId);
            return next;
        });
    }, []);

    const sentenceField = settings?.sentenceField;

    const filteredNotes = useMemo(() => {
        if (!search.trim()) return notes;
        const lower = search.toLowerCase();
        return notes.filter((note) => {
            const keyValue = Object.values(note.fields).find((f) => f.order === 0)?.value ?? '';
            const sentence = sentenceField ? note.fields[sentenceField]?.value ?? '' : '';
            const combined = (keyValue + ' ' + sentence).toLowerCase();
            return combined.includes(lower);
        });
    }, [notes, search, sentenceField]);

    if (!open) return null;

    return (
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {/* Backdrop */}
                <Box
                    sx={{
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(0,0,0,0.6)',
                    }}
                    onClick={handleCancel}
                >
                    {/* Panel */}
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: 420,
                            maxWidth: '90vw',
                            maxHeight: '70vh',
                            p: 2,
                            gap: 1,
                            bgcolor: 'rgba(18,18,18,0.97)',
                            color: 'text.primary',
                            borderRadius: 2,
                            boxShadow: 8,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="h6">{t('cardSelectUi.title')}</Typography>
                            <Typography
                                variant="body2"
                                sx={{ cursor: 'pointer', color: 'text.secondary' }}
                                onClick={handleCancel}
                            >
                                {t('action.cancel')}
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <TextField
                                size="small"
                                placeholder={t('cardSelectUi.searchPlaceholder')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                                sx={{ flex: 1, mr: 1 }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon fontSize="small" />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={multiSelect}
                                        onChange={(e) => handleMultiSelectChange(e.target.checked)}
                                    />
                                }
                                label={
                                    <Typography variant="caption" noWrap>
                                        {t('cardSelectUi.multiSelect')}
                                    </Typography>
                                }
                                sx={{ m: 0, flexShrink: 0 }}
                            />
                        </Box>

                        {error && <Alert severity="error">{error}</Alert>}

                        {(loading || updating) ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
                                <CircularProgress size={32} />
                            </Box>
                        ) : (
                            <List dense sx={{ flex: 1, overflow: 'auto' }}>
                                {filteredNotes.length === 0 && !loading && (
                                    <Typography variant="body2" sx={{ color: 'text.secondary', p: 1 }}>
                                        {t('cardSelectUi.noResults')}
                                    </Typography>
                                )}
                                {filteredNotes.map((note) => {
                                    const keyValue = Object.values(note.fields).find((f) => f.order === 0)?.value ?? `Note ${note.noteId}`;
                                    const rawSentence = sentenceField ? note.fields[sentenceField]?.value ?? '' : '';
                                    const sentence = rawSentence.replace(/<[^>]+>/g, '').slice(0, 80);
                                    if (multiSelect) {
                                        return (
                                            <ListItemButton
                                                key={note.noteId}
                                                onClick={() => handleToggleId(note.noteId)}
                                                disabled={updating}
                                                dense
                                            >
                                                <Checkbox
                                                    edge="start"
                                                    size="small"
                                                    checked={selectedIds.has(note.noteId)}
                                                    tabIndex={-1}
                                                    disableRipple
                                                />
                                                <ListItemText
                                                    primary={keyValue}
                                                    secondary={sentence || note.modelName}
                                                    primaryTypographyProps={{ noWrap: true }}
                                                    secondaryTypographyProps={{ noWrap: true }}
                                                />
                                            </ListItemButton>
                                        );
                                    }
                                    return (
                                        <ListItemButton
                                            key={note.noteId}
                                            onClick={() => handleSelect(note.noteId)}
                                            disabled={updating}
                                        >
                                            <ListItemText
                                                primary={keyValue}
                                                secondary={sentence || note.modelName}
                                                primaryTypographyProps={{ noWrap: true }}
                                                secondaryTypographyProps={{ noWrap: true }}
                                            />
                                        </ListItemButton>
                                    );
                                })}
                            </List>
                        )}

                        {multiSelect && (
                            <Button
                                variant="contained"
                                disabled={selectedIds.size === 0 || updating}
                                onClick={handleApply}
                                fullWidth
                                size="small"
                            >
                                {t('action.apply')} {selectedIds.size > 0 && `(${selectedIds.size})`}
                            </Button>
                        )}
                    </Box>
                </Box>
            </ThemeProvider>
        </StyledEngineProvider>
    );
}
