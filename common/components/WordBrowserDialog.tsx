import { memo, MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
    DictionaryAnkiCardRecord,
    DictionaryProvider,
    DictionaryTokenKey,
    DictionaryTokenRecord,
    LOCAL_TOKEN_TRACK,
} from '@project/common/dictionary-db';
import {
    ApplyStrategy,
    DictionaryTokenSource,
    DictionaryTrack,
    getFullyKnownTokenStatus,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import { getCardTokenStatus } from '@project/common/subtitle-annotations';
import { convertToKanaForSearch, normalizeForSearch } from '@project/common/util';
import { Yomitan } from '@project/common/yomitan';

type SortField = 'token' | 'lemmas' | 'source' | 'status' | 'states' | 'track' | 'cardIds' | 'noteIds' | 'suspended';
type SortDirection = 'asc' | 'desc';
type MatchGroup = 0 | 1 | 2 | 3;
type SuspendedFilter = 'all' | 'yes' | 'no' | 'mixed';
type FilterMode = 'include' | 'exclude';

interface Props {
    open: boolean;
    dictionaryProvider: DictionaryProvider;
    activeProfile?: string;
    track: number;
    dictionaryTrack: DictionaryTrack;
    onClose: () => void;
}

interface SearchExpansion {
    exactTerms: string[];
    lemmaTerms: string[];
    yomitanError?: string;
}

interface WordBrowserRow {
    tokenKey: DictionaryTokenKey;
    selectionKey: string;
    selectable: boolean;
    token: string;
    tokenSearchTerms: string[];
    lemmas: string[];
    lemmasDisplay: string;
    lemmaSearchTerms: string[];
    source: DictionaryTokenSource;
    sourceDisplay: string;
    status: TokenStatus;
    states: TokenState[];
    statesDisplay: string;
    trackDisplay: string;
    trackSortValue: number;
    cardIds: number[];
    cardIdsDisplay: string;
    noteIds: number[];
    noteIdsDisplay: string;
    suspendedDisplay: string;
    suspendedFilterValue: SuspendedFilter;
    suspendedSortValue: number;
    suspendedColor?: string;
}

interface ViewCriteria {
    searchQuery: string;
    selectedSourceFilters: Partial<Record<DictionaryTokenSource, FilterMode>>;
    selectedStatusFilters: Partial<Record<TokenStatus, FilterMode>>;
    selectedStateFilters: Partial<Record<TokenState, FilterMode>>;
    selectedTrackFilters: Partial<Record<number, FilterMode>>;
    cardIdFilter: string;
    noteIdFilter: string;
    suspendedFilter: SuspendedFilter;
    sortField: SortField;
    sortDirection: SortDirection;
}

type AutoRefreshViewCriteria = Pick<
    ViewCriteria,
    | 'searchQuery'
    | 'selectedSourceFilters'
    | 'selectedStatusFilters'
    | 'selectedStateFilters'
    | 'selectedTrackFilters'
    | 'cardIdFilter'
    | 'noteIdFilter'
    | 'suspendedFilter'
    | 'sortField'
    | 'sortDirection'
>;

interface WordBrowserTableRowProps {
    row: WordBrowserRow;
    selected: boolean;
    onSelectRow: (selectionKey: string, options: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => void;
    renderStatusLabel: (status: TokenStatus) => React.ReactNode;
}

type FilterModeValue = string | number;
type FilterMap<T extends FilterModeValue> = Partial<Record<T, FilterMode>>;
type FilterCriteriaKey =
    | 'selectedSourceFilters'
    | 'selectedStatusFilters'
    | 'selectedStateFilters'
    | 'selectedTrackFilters';
type FilterCriteriaValue<K extends FilterCriteriaKey> = ViewCriteria[K] extends FilterMap<infer T> ? T : never;
type TextCriteriaKey = 'searchQuery' | 'cardIdFilter' | 'noteIdFilter';

interface CyclingFilterSelectProps<T extends FilterModeValue> {
    options: readonly T[];
    selectedFilters: FilterMap<T>;
    placeholder: string;
    onToggle: (value: T) => void;
    renderSelectedValue: (value: T, index: number) => React.ReactNode;
    renderMenuItemLabel: (value: T) => React.ReactNode;
}

function normalizeSearchText(text: string) {
    return text.normalize('NFKC').trim().toLocaleLowerCase();
}

function normalizedLookupTerms(...texts: Array<string | null | undefined>) {
    return Array.from(
        new Set(
            texts
                .flatMap((text) => {
                    if (!text) return [];
                    const normalized = normalizeForSearch(text);
                    if (!normalized.length || normalized === text) return [text];
                    return [text, normalized];
                })
                .filter((text): text is string => Boolean(text))
                .map(normalizeSearchText)
                .filter((text) => text.length > 0)
        )
    );
}

function matchesSearchTerm(searchTerms: string[], term: string) {
    return searchTerms.some((searchTerm) => searchTerm.includes(term));
}

function cycleFilterMode<T extends FilterModeValue>(filters: FilterMap<T>, value: T): FilterMap<T> {
    const nextFilters = { ...filters };
    const currentMode = nextFilters[value];

    if (currentMode === undefined) {
        nextFilters[value] = 'include';
    } else if (currentMode === 'include') {
        nextFilters[value] = 'exclude';
    } else {
        delete nextFilters[value];
    }

    return nextFilters;
}

function renderFilterLabel(label: string, mode?: FilterMode) {
    return mode === 'exclude' ? `- ${label}` : label;
}

function cycleViewCriteriaFilter<K extends FilterCriteriaKey>(
    criteria: ViewCriteria,
    key: K,
    value: FilterCriteriaValue<K>
): ViewCriteria {
    return {
        ...criteria,
        [key]: cycleFilterMode(criteria[key] as FilterMap<FilterCriteriaValue<K>>, value),
    } as ViewCriteria;
}

function tokenKeyToString(key: DictionaryTokenKey) {
    return JSON.stringify(key);
}

function compareValues(lhs: string | number, rhs: string | number) {
    if (typeof lhs === 'number' && typeof rhs === 'number') return lhs - rhs;
    return String(lhs).localeCompare(String(rhs), undefined, { sensitivity: 'base', numeric: true });
}

function dedupeNumbers(values: number[]) {
    return Array.from(new Set(values)).sort((lhs, rhs) => lhs - rhs);
}

function formatList(values: Array<string | number>) {
    return values.join(' · ');
}

function filterableTokenStatuses() {
    const statuses: TokenStatus[] = [];
    for (let status = getFullyKnownTokenStatus(); status >= TokenStatus.UNCOLLECTED; --status) {
        statuses.push(status as TokenStatus);
    }
    return statuses;
}

function filterableTokenSources() {
    return [
        DictionaryTokenSource.LOCAL,
        DictionaryTokenSource.ANKI_WORD,
        DictionaryTokenSource.ANKI_SENTENCE,
    ] as DictionaryTokenSource[];
}

const FILTERABLE_STATES: readonly TokenState[] = [TokenState.IGNORED];

function defaultViewCriteria(): ViewCriteria {
    return {
        searchQuery: '',
        selectedSourceFilters: {},
        selectedStatusFilters: {},
        selectedStateFilters: {},
        selectedTrackFilters: {},
        cardIdFilter: '',
        noteIdFilter: '',
        suspendedFilter: 'all',
        sortField: 'token',
        sortDirection: 'asc',
    };
}

function autoRefreshViewCriteria(viewCriteria: ViewCriteria): AutoRefreshViewCriteria {
    return {
        searchQuery: viewCriteria.searchQuery,
        selectedSourceFilters: viewCriteria.selectedSourceFilters,
        selectedStatusFilters: viewCriteria.selectedStatusFilters,
        selectedStateFilters: viewCriteria.selectedStateFilters,
        selectedTrackFilters: viewCriteria.selectedTrackFilters,
        cardIdFilter: viewCriteria.cardIdFilter,
        noteIdFilter: viewCriteria.noteIdFilter,
        suspendedFilter: viewCriteria.suspendedFilter,
        sortField: viewCriteria.sortField,
        sortDirection: viewCriteria.sortDirection,
    };
}

function autoRefreshCriteriaEqual(lhs: AutoRefreshViewCriteria, rhs: AutoRefreshViewCriteria) {
    return (
        lhs.searchQuery === rhs.searchQuery &&
        lhs.cardIdFilter === rhs.cardIdFilter &&
        lhs.noteIdFilter === rhs.noteIdFilter &&
        lhs.suspendedFilter === rhs.suspendedFilter &&
        lhs.sortField === rhs.sortField &&
        lhs.sortDirection === rhs.sortDirection &&
        Object.keys(lhs.selectedTrackFilters).length === Object.keys(rhs.selectedTrackFilters).length &&
        Object.keys(lhs.selectedTrackFilters).every(
            (track) => lhs.selectedTrackFilters[Number(track)] === rhs.selectedTrackFilters[Number(track)]
        ) &&
        filterableTokenSources().every(
            (source) => lhs.selectedSourceFilters[source] === rhs.selectedSourceFilters[source]
        ) &&
        filterableTokenStatuses().every(
            (status) => lhs.selectedStatusFilters[status] === rhs.selectedStatusFilters[status]
        ) &&
        FILTERABLE_STATES.every((state) => lhs.selectedStateFilters[state] === rhs.selectedStateFilters[state])
    );
}

function applyAutoRefreshViewCriteria(
    currentViewCriteria: ViewCriteria,
    nextAutoRefreshCriteria: AutoRefreshViewCriteria
): ViewCriteria {
    return {
        ...currentViewCriteria,
        ...nextAutoRefreshCriteria,
    };
}

const textFilterAutoRefreshDelayMs = 500;
const multiSelectAutoRefreshDelayMs = 300;
const singleSelectAutoRefreshDelayMs = 0;

const WordBrowserTableRow = memo(function WordBrowserTableRow({
    row,
    selected,
    onSelectRow,
    renderStatusLabel,
}: WordBrowserTableRowProps) {
    const handleSelect = useCallback(
        (event: ReactMouseEvent) => {
            if (!row.selectable) return;
            onSelectRow(row.selectionKey, {
                shiftKey: event.shiftKey,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
            });
        },
        [onSelectRow, row.selectable, row.selectionKey]
    );

    return (
        <TableRow
            hover
            selected={selected}
            onClick={handleSelect}
            sx={row.selectable ? { cursor: 'pointer' } : undefined}
        >
            <TableCell padding="checkbox">
                {row.selectable && (
                    <Checkbox
                        checked={selected}
                        onClick={(event) => {
                            event.stopPropagation();
                            handleSelect(event);
                        }}
                        onChange={() => undefined}
                    />
                )}
            </TableCell>
            <TableCell>{row.token}</TableCell>
            <TableCell>{row.lemmasDisplay}</TableCell>
            <TableCell>{row.sourceDisplay}</TableCell>
            <TableCell>{renderStatusLabel(row.status)}</TableCell>
            <TableCell>{row.statesDisplay}</TableCell>
            <TableCell>{row.trackDisplay}</TableCell>
            <TableCell>{row.cardIdsDisplay}</TableCell>
            <TableCell>{row.noteIdsDisplay}</TableCell>
            <TableCell>
                <Typography sx={{ color: row.suspendedColor }}>{row.suspendedDisplay}</Typography>
            </TableCell>
        </TableRow>
    );
});

function CyclingFilterSelect<T extends FilterModeValue>({
    options,
    selectedFilters,
    placeholder,
    onToggle,
    renderSelectedValue,
    renderMenuItemLabel,
}: CyclingFilterSelectProps<T>) {
    const selectedValues = options.filter((value) => selectedFilters[value] !== undefined);

    return (
        <FormControl size="small" fullWidth>
            <Select
                multiple
                displayEmpty
                value={selectedValues}
                onChange={() => undefined}
                input={<OutlinedInput />}
                renderValue={() =>
                    selectedValues.length ? (
                        selectedValues.map(renderSelectedValue)
                    ) : (
                        <Typography color="text.secondary">{placeholder}</Typography>
                    )
                }
            >
                {options.map((value) => (
                    <MenuItem
                        key={String(value)}
                        value={value}
                        onClick={(event) => {
                            event.preventDefault();
                            onToggle(value);
                        }}
                    >
                        <Checkbox
                            checked={selectedFilters[value] === 'include'}
                            indeterminate={selectedFilters[value] === 'exclude'}
                        />
                        {renderMenuItemLabel(value)}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}

export default function WordBrowserDialog({
    open,
    dictionaryProvider,
    activeProfile,
    track,
    dictionaryTrack,
    onClose,
}: Props) {
    const { t } = useTranslation();
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const yomitan = useMemo(() => new Yomitan(dictionaryTrack), [dictionaryTrack]);
    const yomitanVersionPromiseRef = useRef<Promise<void> | undefined>(undefined);
    const filterableSources = useMemo(() => filterableTokenSources(), []);
    const filterableStates = FILTERABLE_STATES;
    const filterStatusOptions = useMemo(() => filterableTokenStatuses(), []);
    const [records, setRecords] = useState<{
        tokenRecords: DictionaryTokenRecord[];
        ankiCardRecords: DictionaryAnkiCardRecord[];
    }>({
        tokenRecords: [],
        ankiCardRecords: [],
    });
    const [loading, setLoading] = useState(false);
    const [mutating, setMutating] = useState(false);
    const [loadError, setLoadError] = useState<string>();
    const [draftViewCriteria, setDraftViewCriteria] = useState<ViewCriteria>(() => defaultViewCriteria());
    const [appliedViewCriteria, setAppliedViewCriteria] = useState<ViewCriteria>(() => defaultViewCriteria());
    const [searchExpansion, setSearchExpansion] = useState<SearchExpansion>({ exactTerms: [], lemmaTerms: [] });
    const [searchExpansionRefreshToken, setSearchExpansionRefreshToken] = useState(0);
    const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
    const [bulkStatus, setBulkStatus] = useState<TokenStatus | ''>('');
    const [bulkStates, setBulkStates] = useState<TokenState[]>([]);
    const [bulkStatesApplyStrategy, setBulkStatesApplyStrategy] = useState<ApplyStrategy>(ApplyStrategy.REPLACE);
    const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [pendingAutoRefreshDelayMs, setPendingAutoRefreshDelayMs] = useState<number>();
    const loadRequestIdRef = useRef(0);
    const selectionAnchorKeyRef = useRef<string | undefined>(undefined);
    const draftAutoRefreshCriteria = useMemo(() => autoRefreshViewCriteria(draftViewCriteria), [draftViewCriteria]);
    const appliedAutoRefreshCriteria = useMemo(
        () => autoRefreshViewCriteria(appliedViewCriteria),
        [appliedViewCriteria]
    );

    const updateDraftViewCriteria = useCallback((delayMs: number, updater: (current: ViewCriteria) => ViewCriteria) => {
        setPendingAutoRefreshDelayMs(delayMs);
        setDraftViewCriteria(updater);
    }, []);

    const updateDraftTextCriteria = useCallback(
        (key: TextCriteriaKey, value: string, delayMs = textFilterAutoRefreshDelayMs) => {
            updateDraftViewCriteria(delayMs, (current) => ({
                ...current,
                [key]: value,
            }));
        },
        [updateDraftViewCriteria]
    );

    const clearDraftTextCriteria = useCallback(
        (key: TextCriteriaKey) => updateDraftTextCriteria(key, '', singleSelectAutoRefreshDelayMs),
        [updateDraftTextCriteria]
    );

    const cycleFilter = useCallback(
        <K extends FilterCriteriaKey>(key: K, value: FilterCriteriaValue<K>) => {
            updateDraftViewCriteria(multiSelectAutoRefreshDelayMs, (current) =>
                cycleViewCriteriaFilter(current, key, value)
            );
        },
        [updateDraftViewCriteria]
    );

    const loadRecords = useCallback(
        async (viewCriteria: ViewCriteria) => {
            const requestId = ++loadRequestIdRef.current;
            setPendingAutoRefreshDelayMs(undefined);
            setAppliedViewCriteria(viewCriteria);
            yomitanVersionPromiseRef.current = undefined;
            setSearchExpansionRefreshToken((current) => current + 1);
            setLoading(true);
            setLoadError(undefined);
            try {
                const nextRecords = await dictionaryProvider.getRecords(activeProfile, track);
                if (requestId !== loadRequestIdRef.current) return;
                setRecords(nextRecords);
            } catch (error) {
                if (requestId !== loadRequestIdRef.current) return;
                setLoadError(error instanceof Error ? error.message : String(error));
            } finally {
                if (requestId !== loadRequestIdRef.current) return;
                setLoading(false);
            }
        },
        [dictionaryProvider, activeProfile, track]
    );

    useEffect(() => {
        if (!open) return;
        const initialViewCriteria = defaultViewCriteria();
        setDraftViewCriteria(initialViewCriteria);
        setSelectedRowKeys(new Set());
        setBulkStatus('');
        setBulkStates([]);
        setBulkStatesApplyStrategy(ApplyStrategy.REPLACE);
        setConfirmApplyOpen(false);
        setConfirmDeleteOpen(false);
        selectionAnchorKeyRef.current = undefined;
        void loadRecords(initialViewCriteria);
    }, [loadRecords, open]);

    useEffect(() => {
        if (!open || autoRefreshCriteriaEqual(appliedAutoRefreshCriteria, draftAutoRefreshCriteria)) return;
        if (pendingAutoRefreshDelayMs === undefined) return;
        const timeoutId = setTimeout(() => {
            setAppliedViewCriteria((current) => {
                const currentAutoRefreshCriteria = autoRefreshViewCriteria(current);
                if (autoRefreshCriteriaEqual(currentAutoRefreshCriteria, draftAutoRefreshCriteria)) return current;
                return applyAutoRefreshViewCriteria(current, draftAutoRefreshCriteria);
            });
            setPendingAutoRefreshDelayMs(undefined);
        }, pendingAutoRefreshDelayMs);
        return () => clearTimeout(timeoutId);
    }, [appliedAutoRefreshCriteria, draftAutoRefreshCriteria, open, pendingAutoRefreshDelayMs]);

    useEffect(() => {
        if (open) return;
        loadRequestIdRef.current += 1;
        const initialViewCriteria = defaultViewCriteria();
        setRecords({ tokenRecords: [], ankiCardRecords: [] });
        setLoading(false);
        setDraftViewCriteria(initialViewCriteria);
        setAppliedViewCriteria(initialViewCriteria);
        setSelectedRowKeys(new Set());
        setLoadError(undefined);
        setSearchExpansion({ exactTerms: [], lemmaTerms: [] });
        setBulkStatus('');
        setBulkStates([]);
        setBulkStatesApplyStrategy(ApplyStrategy.REPLACE);
        setConfirmApplyOpen(false);
        setConfirmDeleteOpen(false);
        selectionAnchorKeyRef.current = undefined;
        setPendingAutoRefreshDelayMs(undefined);
    }, [open]);

    const ensureYomitanVersion = useCallback(async () => {
        if (yomitanVersionPromiseRef.current) return yomitanVersionPromiseRef.current;
        const versionPromise = yomitan.version().then(() => undefined);
        yomitanVersionPromiseRef.current = versionPromise;
        try {
            await versionPromise;
        } catch (error) {
            yomitanVersionPromiseRef.current = undefined;
            throw error;
        }
    }, [yomitan]);

    useEffect(() => {
        yomitanVersionPromiseRef.current = undefined;
    }, [yomitan]);

    useEffect(() => {
        if (!open) return;
        void ensureYomitanVersion();
    }, [ensureYomitanVersion, open]);

    const statusColors = useMemo(() => {
        const colors = {} as Record<TokenStatus, string>;
        for (let status = TokenStatus.UNCOLLECTED; status <= getFullyKnownTokenStatus(); ++status) {
            const config = dictionaryTrack.dictionaryTokenStatusConfig[status] ?? {
                color: '#9E9E9E',
                alpha: 'FF',
                display: true,
            };
            colors[status as TokenStatus] = `${config.color}${config.alpha}`;
        }
        return colors;
    }, [dictionaryTrack.dictionaryTokenStatusConfig]);

    const renderStatusLabel = useCallback(
        (status: TokenStatus) => (
            <Typography component="span" sx={{ color: statusColors[status], fontWeight: 500 }}>
                {t(`settings.dictionaryTokenStatus${status}`)}
            </Typography>
        ),
        [statusColors, t]
    );

    useEffect(() => {
        if (!open) return;
        const trimmed = appliedViewCriteria.searchQuery.trim();
        if (!trimmed.length) {
            setSearchExpansion({ exactTerms: [], lemmaTerms: [] });
            return;
        }
        let cancelled = false;

        void (async () => {
            const queryForms = Array.from(new Set([trimmed, convertToKanaForSearch(trimmed)])).filter(
                (queryForm) => queryForm.length > 0
            );
            const exactTerms = normalizedLookupTerms(...queryForms);
            try {
                await ensureYomitanVersion();
                if (cancelled) return;
                const lemmaTerms = new Set<string>();
                for (const exactTerm of queryForms) {
                    if (cancelled) return;
                    const lemmas = (await yomitan.lemmatize(exactTerm)) ?? [];
                    if (cancelled) return;
                    for (const lemma of lemmas) {
                        for (const normalizedLemma of normalizedLookupTerms(lemma)) {
                            lemmaTerms.add(normalizedLemma);
                        }
                    }
                    const kanaLemma = convertToKanaForSearch(exactTerm);
                    if (kanaLemma && kanaLemma !== exactTerm) {
                        if (cancelled) return;
                        const kanaLemmas = (await yomitan.lemmatize(kanaLemma)) ?? [];
                        if (cancelled) return;
                        for (const lemma of kanaLemmas) {
                            for (const normalizedLemma of normalizedLookupTerms(lemma)) {
                                lemmaTerms.add(normalizedLemma);
                            }
                        }
                    }
                }
                if (!cancelled) setSearchExpansion({ exactTerms, lemmaTerms: Array.from(lemmaTerms) });
            } catch (error) {
                if (!cancelled) {
                    setSearchExpansion({
                        exactTerms,
                        lemmaTerms: [],
                        yomitanError: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        appliedViewCriteria.searchQuery,
        dictionaryTrack,
        ensureYomitanVersion,
        open,
        searchExpansionRefreshToken,
        yomitan,
    ]);

    const sourceLabels = useMemo(
        () => ({
            [DictionaryTokenSource.LOCAL]: t('settings.dictionaryBrowser.sources.local'),
            [DictionaryTokenSource.ANKI_WORD]: t('settings.dictionaryBrowser.sources.ankiWord'),
            [DictionaryTokenSource.ANKI_SENTENCE]: t('settings.dictionaryBrowser.sources.ankiSentence'),
        }),
        [t]
    );

    const stateLabels = useMemo(
        () => ({
            [TokenState.IGNORED]: t('settings.dictionaryTokenStateIgnored'),
        }),
        [t]
    );

    const stateApplyStrategyLabels = useMemo(
        () => ({
            [ApplyStrategy.ADD]: t('settings.applyStrategies.add'),
            [ApplyStrategy.REMOVE]: t('settings.applyStrategies.remove'),
            [ApplyStrategy.REPLACE]: t('settings.applyStrategies.replace'),
            [ApplyStrategy.TOGGLE]: t('settings.applyStrategies.toggle'),
        }),
        [t]
    );

    const renderStatusFilterLabel = useCallback(
        (status: TokenStatus) =>
            renderFilterLabel(
                t(`settings.dictionaryTokenStatus${status}`),
                draftViewCriteria.selectedStatusFilters[status]
            ),
        [draftViewCriteria.selectedStatusFilters, t]
    );

    const renderSourceFilterLabel = useCallback(
        (source: DictionaryTokenSource) =>
            renderFilterLabel(sourceLabels[source], draftViewCriteria.selectedSourceFilters[source]),
        [draftViewCriteria.selectedSourceFilters, sourceLabels]
    );

    const renderStateFilterLabel = useCallback(
        (state: TokenState) => renderFilterLabel(stateLabels[state], draftViewCriteria.selectedStateFilters[state]),
        [draftViewCriteria.selectedStateFilters, stateLabels]
    );

    const rows = useMemo(() => {
        const cardRecordMap = new Map<number, DictionaryAnkiCardRecord>();
        for (const record of records.ankiCardRecords) cardRecordMap.set(record.cardId, record);
        const treatSuspended = dictionaryTrack.dictionaryAnkiTreatSuspended;
        return records.tokenRecords.map((record) => {
            const cardRecords = record.cardIds
                .map((cardId) => cardRecordMap.get(cardId))
                .filter((cardRecord): cardRecord is DictionaryAnkiCardRecord => cardRecord !== undefined);
            const noteIds = dedupeNumbers(cardRecords.map((cardRecord) => cardRecord.noteId));
            const status =
                record.source === DictionaryTokenSource.LOCAL
                    ? record.status!
                    : getCardTokenStatus(
                          cardRecords.map((cardRecord) => ({
                              cardId: cardRecord.cardId,
                              status: cardRecord.status,
                              suspended: cardRecord.suspended,
                          })),
                          treatSuspended
                      );
            const suspendedValues = Array.from(new Set(cardRecords.map((cardRecord) => cardRecord.suspended)));
            let suspendedDisplay = '';
            let suspendedFilterValue: SuspendedFilter = 'all';
            let suspendedSortValue = -1;
            let suspendedColor: string | undefined;

            if (record.source !== DictionaryTokenSource.LOCAL) {
                if (!suspendedValues.length || suspendedValues.every((value) => !value)) {
                    suspendedDisplay = t('settings.dictionaryBrowser.suspended.no');
                    suspendedFilterValue = 'no';
                    suspendedSortValue = 0;
                    suspendedColor = theme.palette.success.main;
                } else if (suspendedValues.every(Boolean)) {
                    suspendedDisplay = t('settings.dictionaryBrowser.suspended.yes');
                    suspendedFilterValue = 'yes';
                    suspendedSortValue = 2;
                    suspendedColor = theme.palette.warning.dark;
                } else {
                    suspendedDisplay = t('settings.dictionaryBrowser.suspended.mixed');
                    suspendedFilterValue = 'mixed';
                    suspendedSortValue = 1;
                    suspendedColor = theme.palette.warning.main;
                }
            }
            const lemmasDisplay = formatList(record.lemmas);
            const statesDisplay = formatList(record.states.map((state) => stateLabels[state]));
            const dedupedCardIds = dedupeNumbers(record.cardIds);

            return {
                tokenKey: [record.token, record.source, record.track, record.profile],
                selectionKey: tokenKeyToString([record.token, record.source, record.track, record.profile]),
                selectable: record.source === DictionaryTokenSource.LOCAL,
                token: record.token,
                tokenSearchTerms: normalizedLookupTerms(record.token),
                lemmas: record.lemmas,
                lemmasDisplay,
                lemmaSearchTerms: Array.from(new Set(record.lemmas.flatMap((lemma) => normalizedLookupTerms(lemma)))),
                source: record.source,
                sourceDisplay: sourceLabels[record.source],
                status,
                states: record.states,
                statesDisplay,
                trackDisplay: record.source === DictionaryTokenSource.LOCAL ? '' : String(record.track + 1),
                trackSortValue: record.source === DictionaryTokenSource.LOCAL ? LOCAL_TOKEN_TRACK : record.track + 1,
                cardIds: dedupedCardIds,
                cardIdsDisplay: record.source === DictionaryTokenSource.LOCAL ? '' : formatList(dedupedCardIds),
                noteIds,
                noteIdsDisplay: record.source === DictionaryTokenSource.LOCAL ? '' : formatList(noteIds),
                suspendedDisplay,
                suspendedFilterValue,
                suspendedSortValue,
                suspendedColor,
            } satisfies WordBrowserRow;
        });
    }, [
        dictionaryTrack.dictionaryAnkiTreatSuspended,
        records,
        sourceLabels,
        stateLabels,
        t,
        theme.palette.success.main,
        theme.palette.warning.dark,
        theme.palette.warning.main,
    ]);

    const trackFilterOptions = useMemo(() => {
        const trackValues = Array.from(new Set(rows.map((row) => row.trackSortValue))).sort((lhs, rhs) => lhs - rhs);
        return trackValues.map((trackValue) => ({
            value: trackValue,
            label:
                trackValue === LOCAL_TOKEN_TRACK
                    ? sourceLabels[DictionaryTokenSource.LOCAL]
                    : t('settings.subtitleTrackChoice', { trackNumber: trackValue }),
        }));
    }, [rows, sourceLabels, t]);

    const renderTrackFilterLabel = useCallback(
        (trackValue: number) => {
            const trackLabel =
                trackFilterOptions.find((option) => option.value === trackValue)?.label ??
                (trackValue === LOCAL_TOKEN_TRACK
                    ? sourceLabels[DictionaryTokenSource.LOCAL]
                    : t('settings.subtitleTrackChoice', { trackNumber: trackValue }));
            return renderFilterLabel(trackLabel, draftViewCriteria.selectedTrackFilters[trackValue]);
        },
        [draftViewCriteria.selectedTrackFilters, sourceLabels, t, trackFilterOptions]
    );

    const visibleRows = useMemo(() => {
        const cardIdFilterTerms = appliedViewCriteria.cardIdFilter.split(/\D+/).filter((value) => value.length);
        const noteIdFilterTerms = appliedViewCriteria.noteIdFilter.split(/\D+/).filter((value) => value.length);
        const includedTrackFilters = trackFilterOptions
            .map((option) => option.value)
            .filter((trackValue) => appliedViewCriteria.selectedTrackFilters[trackValue] === 'include');
        const excludedTrackFilters = trackFilterOptions
            .map((option) => option.value)
            .filter((trackValue) => appliedViewCriteria.selectedTrackFilters[trackValue] === 'exclude');
        const includedSourceFilters = filterableSources.filter(
            (source) => appliedViewCriteria.selectedSourceFilters[source] === 'include'
        );
        const excludedSourceFilters = filterableSources.filter(
            (source) => appliedViewCriteria.selectedSourceFilters[source] === 'exclude'
        );
        const includedStatusFilters = filterStatusOptions.filter(
            (status) => appliedViewCriteria.selectedStatusFilters[status] === 'include'
        );
        const excludedStatusFilters = filterStatusOptions.filter(
            (status) => appliedViewCriteria.selectedStatusFilters[status] === 'exclude'
        );
        const includedStateFilters = filterableStates.filter(
            (state) => appliedViewCriteria.selectedStateFilters[state] === 'include'
        );
        const excludedStateFilters = filterableStates.filter(
            (state) => appliedViewCriteria.selectedStateFilters[state] === 'exclude'
        );

        const filtered = rows.filter((row) => {
            if (includedSourceFilters.length > 0 && !includedSourceFilters.includes(row.source)) return false;
            if (excludedSourceFilters.includes(row.source)) return false;
            if (includedStatusFilters.length > 0 && !includedStatusFilters.includes(row.status)) return false;
            if (excludedStatusFilters.includes(row.status)) return false;
            if (includedStateFilters.some((state) => !row.states.includes(state))) return false;
            if (excludedStateFilters.some((state) => row.states.includes(state))) return false;
            if (includedTrackFilters.length > 0 && !includedTrackFilters.includes(row.trackSortValue)) return false;
            if (excludedTrackFilters.includes(row.trackSortValue)) return false;
            if (appliedViewCriteria.suspendedFilter !== 'all') {
                if (row.source === DictionaryTokenSource.LOCAL) {
                    if (appliedViewCriteria.suspendedFilter !== 'no') return false;
                } else {
                    if (row.suspendedFilterValue !== appliedViewCriteria.suspendedFilter) return false;
                }
            }
            if (cardIdFilterTerms.length && !cardIdFilterTerms.some((term) => row.cardIdsDisplay.includes(term))) {
                return false;
            }
            if (noteIdFilterTerms.length && !noteIdFilterTerms.some((term) => row.noteIdsDisplay.includes(term))) {
                return false;
            }
            return true;
        });

        const exactTerms = searchExpansion.exactTerms;
        const lemmaTerms = searchExpansion.lemmaTerms;
        const hasSearch = exactTerms.length > 0 || lemmaTerms.length > 0;
        const matchGroups = new Map<string, MatchGroup>();

        if (!hasSearch) {
            for (const row of filtered) matchGroups.set(row.selectionKey, 0);
        } else {
            const exactRows: WordBrowserRow[] = [];
            const lemmaRows: WordBrowserRow[] = [];
            const remainder: WordBrowserRow[] = [];

            for (const row of filtered) {
                const matchesExact = exactTerms.some(
                    (term) =>
                        matchesSearchTerm(row.tokenSearchTerms, term) || matchesSearchTerm(row.lemmaSearchTerms, term)
                );
                if (matchesExact) {
                    exactRows.push(row);
                } else {
                    remainder.push(row);
                }
            }

            const exactLemmaSet = new Set(exactRows.flatMap((row) => row.lemmaSearchTerms));
            const trailingRows: WordBrowserRow[] = [];

            for (const row of remainder) {
                const matchesLemma = lemmaTerms.some(
                    (term) =>
                        matchesSearchTerm(row.tokenSearchTerms, term) || matchesSearchTerm(row.lemmaSearchTerms, term)
                );
                if (matchesLemma) {
                    lemmaRows.push(row);
                    continue;
                }

                const sharesLemma = row.lemmaSearchTerms.some((lemma) => exactLemmaSet.has(lemma));
                if (sharesLemma) trailingRows.push(row);
            }

            for (const row of exactRows) matchGroups.set(row.selectionKey, 0);
            for (const row of lemmaRows) matchGroups.set(row.selectionKey, 1);
            for (const row of trailingRows) matchGroups.set(row.selectionKey, 2);
        }

        const sorted = filtered
            .filter((row) => matchGroups.has(row.selectionKey))
            .sort((lhs, rhs) => {
                const matchDiff = (matchGroups.get(lhs.selectionKey) ?? 3) - (matchGroups.get(rhs.selectionKey) ?? 3);
                if (matchDiff !== 0) return matchDiff;

                let valueDiff = 0;
                switch (appliedViewCriteria.sortField) {
                    case 'token':
                        valueDiff = compareValues(lhs.token, rhs.token);
                        break;
                    case 'lemmas':
                        valueDiff = compareValues(lhs.lemmasDisplay, rhs.lemmasDisplay);
                        break;
                    case 'source':
                        valueDiff = compareValues(lhs.sourceDisplay, rhs.sourceDisplay);
                        break;
                    case 'status':
                        valueDiff = compareValues(lhs.status, rhs.status);
                        break;
                    case 'states':
                        valueDiff = compareValues(lhs.statesDisplay, rhs.statesDisplay);
                        break;
                    case 'track':
                        valueDiff = compareValues(lhs.trackSortValue, rhs.trackSortValue);
                        break;
                    case 'cardIds':
                        valueDiff = compareValues(lhs.cardIdsDisplay, rhs.cardIdsDisplay);
                        break;
                    case 'noteIds':
                        valueDiff = compareValues(lhs.noteIdsDisplay, rhs.noteIdsDisplay);
                        break;
                    case 'suspended':
                        valueDiff = compareValues(lhs.suspendedSortValue, rhs.suspendedSortValue);
                        break;
                }

                if (valueDiff === 0) valueDiff = compareValues(lhs.token, rhs.token);
                return appliedViewCriteria.sortDirection === 'asc' ? valueDiff : -valueDiff;
            });

        return sorted;
    }, [
        appliedViewCriteria,
        filterStatusOptions,
        filterableSources,
        filterableStates,
        rows,
        searchExpansion,
        trackFilterOptions,
    ]);

    useEffect(() => {
        const visibleKeySet = new Set(visibleRows.filter((row) => row.selectable).map((row) => row.selectionKey));
        setSelectedRowKeys((current) => {
            const next = new Set(Array.from(current).filter((key) => visibleKeySet.has(key)));
            return next.size === current.size ? current : next;
        });
    }, [visibleRows]);

    const visibleSelectableRows = useMemo(() => visibleRows.filter((row) => row.selectable), [visibleRows]);
    const visibleSelectableRowsRef = useRef(visibleSelectableRows);
    useEffect(() => {
        visibleSelectableRowsRef.current = visibleSelectableRows;
    }, [visibleSelectableRows]);
    const selectedCount = selectedRowKeys.size;
    const allVisibleSelected =
        visibleSelectableRows.length > 0 && visibleSelectableRows.every((row) => selectedRowKeys.has(row.selectionKey));
    const partiallyVisibleSelected =
        visibleSelectableRows.some((row) => selectedRowKeys.has(row.selectionKey)) && !allVisibleSelected;

    const selectedRows = useMemo(
        () => visibleSelectableRows.filter((row) => selectedRowKeys.has(row.selectionKey)),
        [selectedRowKeys, visibleSelectableRows]
    );

    const canApplyToSelected =
        selectedCount > 0 && (bulkStatus !== '' || bulkStates.length > 0) && !mutating && !loading;

    const handleSelectRow = useCallback(
        (
            selectionKey: string,
            { shiftKey, ctrlKey, metaKey }: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }
        ) => {
            const visibleSelectionKeys = visibleSelectableRowsRef.current.map((row) => row.selectionKey);
            const preserveExisting = ctrlKey || metaKey;

            setSelectedRowKeys((current) => {
                const clickedIndex = visibleSelectionKeys.indexOf(selectionKey);
                if (clickedIndex === -1) return current;

                if (shiftKey) {
                    const anchorKey = selectionAnchorKeyRef.current ?? selectionKey;
                    const anchorIndex = visibleSelectionKeys.indexOf(anchorKey);

                    if (anchorIndex !== -1) {
                        const [start, end] =
                            anchorIndex <= clickedIndex ? [anchorIndex, clickedIndex] : [clickedIndex, anchorIndex];
                        const next = preserveExisting ? new Set(current) : new Set<string>();
                        for (let index = start; index <= end; ++index) next.add(visibleSelectionKeys[index]);
                        return next;
                    }
                }

                if (preserveExisting) {
                    const next = new Set(current);
                    if (next.has(selectionKey)) next.delete(selectionKey);
                    else next.add(selectionKey);
                    return next;
                }

                return new Set([selectionKey]);
            });

            selectionAnchorKeyRef.current = selectionKey;
        },
        []
    );

    const toggleSelectAllVisible = useCallback(() => {
        setSelectedRowKeys((current) => {
            if (visibleSelectableRows.every((row) => current.has(row.selectionKey))) {
                return new Set(
                    Array.from(current).filter((key) => !visibleSelectableRows.some((row) => row.selectionKey === key))
                );
            }
            const next = new Set(current);
            for (const row of visibleSelectableRows) next.add(row.selectionKey);
            return next;
        });
    }, [visibleSelectableRows]);

    const handleSortColumnClick = useCallback(
        (field: SortField) => {
            updateDraftViewCriteria(singleSelectAutoRefreshDelayMs, (current) => {
                if (current.sortField === field) {
                    return {
                        ...current,
                        sortDirection: current.sortDirection === 'asc' ? 'desc' : 'asc',
                    };
                }
                return {
                    ...current,
                    sortField: field,
                    sortDirection: 'asc',
                };
            });
        },
        [updateDraftViewCriteria]
    );

    const renderSortableHeader = useCallback(
        (field: SortField, label: string) => (
            <TableSortLabel
                active={draftViewCriteria.sortField === field}
                direction={draftViewCriteria.sortField === field ? draftViewCriteria.sortDirection : 'asc'}
                onClick={() => handleSortColumnClick(field)}
            >
                {label}
            </TableSortLabel>
        ),
        [draftViewCriteria.sortField, draftViewCriteria.sortDirection, handleSortColumnClick]
    );

    const renderClearAdornment = useCallback(
        (value: string, onClear: () => void) =>
            value.length ? (
                <InputAdornment position="end">
                    <IconButton edge="end" size="small" aria-label={t('action.deleteAll')} onClick={onClear}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </InputAdornment>
            ) : undefined,
        [t]
    );

    const handleApplyToSelected = useCallback(async () => {
        if (!selectedRows.length) return;
        setConfirmApplyOpen(false);
        setMutating(true);
        try {
            await dictionaryProvider.updateRecords(
                activeProfile,
                selectedRows.map((row) => ({
                    tokenKey: row.tokenKey,
                    status: bulkStatus === '' ? row.status : bulkStatus,
                    states: bulkStates.length ? bulkStates : row.states,
                })),
                bulkStates.length ? bulkStatesApplyStrategy : ApplyStrategy.REPLACE // Keep existing states if not modifying
            );
            setSelectedRowKeys(new Set());
            await loadRecords(draftViewCriteria);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : String(error));
        } finally {
            setMutating(false);
        }
    }, [
        activeProfile,
        bulkStates,
        bulkStatesApplyStrategy,
        bulkStatus,
        dictionaryProvider,
        draftViewCriteria,
        loadRecords,
        selectedRows,
    ]);

    const handleDeleteSelected = useCallback(async () => {
        if (!selectedRows.length) return;
        setConfirmDeleteOpen(false);
        setMutating(true);
        try {
            await dictionaryProvider.deleteRecords(
                activeProfile,
                selectedRows.map((row) => row.tokenKey)
            );
            setSelectedRowKeys(new Set());
            await loadRecords(draftViewCriteria);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : String(error));
        } finally {
            setMutating(false);
        }
    }, [activeProfile, dictionaryProvider, draftViewCriteria, loadRecords, selectedRows]);

    return (
        <Dialog open={open} onClose={mutating ? undefined : onClose} fullScreen={fullScreen} fullWidth maxWidth="xl">
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    {t('settings.dictionaryBrowser.title')}
                </Typography>
                <IconButton edge="end" onClick={onClose} disabled={mutating}>
                    <CloseIcon />
                </IconButton>
            </Toolbar>
            <DialogContent sx={{ pt: 1 }}>
                <Stack spacing={2}>
                    {loadError && <Alert severity="error">{loadError}</Alert>}
                    {searchExpansion.yomitanError && appliedViewCriteria.searchQuery.trim().length > 0 && (
                        <Alert severity="warning">
                            {t('settings.dictionaryBrowser.yomitanWarning', { message: searchExpansion.yomitanError })}
                        </Alert>
                    )}
                    <Stack
                        direction={fullScreen ? 'column' : 'row'}
                        spacing={1.5}
                        alignItems={fullScreen ? 'stretch' : 'center'}
                    >
                        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                            {t('settings.dictionaryBrowser.results', {
                                shown: visibleRows.length,
                                total: rows.length,
                                selected: selectedCount,
                            })}
                        </Typography>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={() => void loadRecords(draftViewCriteria)}
                            loading={loading}
                            disabled={mutating}
                        >
                            {t('action.reload')}
                        </Button>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel shrink>{t('settings.dictionaryBrowser.bulkStatus')}</InputLabel>
                            <Select
                                displayEmpty
                                value={bulkStatus}
                                label={t('settings.dictionaryBrowser.bulkStatus')}
                                renderValue={(selected: TokenStatus | string) =>
                                    selected === '' ? (
                                        <Typography component="span" color="text.secondary" sx={{ minHeight: 24 }}>
                                            {t('settings.dictionaryBrowser.bulkStatus')}
                                        </Typography>
                                    ) : (
                                        renderStatusLabel(selected as TokenStatus)
                                    )
                                }
                                onChange={(event) =>
                                    setBulkStatus(
                                        event.target.value === '' ? '' : (Number(event.target.value) as TokenStatus)
                                    )
                                }
                            >
                                <MenuItem value="">
                                    <Typography color="text.secondary">
                                        {t('settings.dictionaryBrowser.bulkStatus')}
                                    </Typography>
                                </MenuItem>
                                {filterStatusOptions.map((tokenStatus) => (
                                    <MenuItem key={tokenStatus} value={tokenStatus}>
                                        <Typography sx={{ color: statusColors[tokenStatus], fontWeight: 500 }}>
                                            {t(`settings.dictionaryTokenStatus${tokenStatus}`)}
                                        </Typography>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>{t('settings.dictionaryBrowser.bulkStates')}</InputLabel>
                            <Select
                                multiple
                                value={bulkStates}
                                onChange={(event) => setBulkStates(event.target.value as TokenState[])}
                                input={<OutlinedInput label={t('settings.dictionaryBrowser.bulkStates')} />}
                                renderValue={(selected) =>
                                    (selected as TokenState[]).map((state) => stateLabels[state]).join(', ')
                                }
                            >
                                {filterableStates.map((state) => (
                                    <MenuItem key={state} value={state}>
                                        <Checkbox checked={bulkStates.includes(state)} />
                                        <ListItemText primary={stateLabels[state]} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>{t('settings.dictionaryBrowser.stateStrategy')}</InputLabel>
                            <Select
                                value={bulkStatesApplyStrategy}
                                label={t('settings.dictionaryBrowser.stateStrategy')}
                                onChange={(event) => setBulkStatesApplyStrategy(event.target.value as ApplyStrategy)}
                            >
                                {(Object.values(ApplyStrategy) as ApplyStrategy[]).map((applyStrategy) => (
                                    <MenuItem key={applyStrategy} value={applyStrategy}>
                                        {stateApplyStrategyLabels[applyStrategy]}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            variant="contained"
                            onClick={() => setConfirmApplyOpen(true)}
                            disabled={!canApplyToSelected}
                            loading={mutating}
                        >
                            {t('settings.dictionaryBrowser.applyToSelected')}
                        </Button>
                        <Dialog open={confirmApplyOpen} onClose={() => setConfirmApplyOpen(false)}>
                            <DialogContent>
                                <Typography>
                                    {t('settings.dictionaryBrowser.confirmApplyToSelected', {
                                        count: selectedCount,
                                    })}
                                </Typography>
                                {bulkStatus === TokenStatus.UNCOLLECTED && (
                                    <Alert severity="warning" sx={{ mt: 2 }}>
                                        {t('settings.dictionaryBrowser.confirmApplyToSelectedDeleteWarning')}
                                    </Alert>
                                )}
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setConfirmApplyOpen(false)}>{t('action.cancel')}</Button>
                                <Button onClick={() => void handleApplyToSelected()}>
                                    {t('settings.dictionaryBrowser.applyToSelected')}
                                </Button>
                            </DialogActions>
                        </Dialog>
                        <Button
                            color="error"
                            variant="outlined"
                            onClick={() => setConfirmDeleteOpen(true)}
                            disabled={!selectedCount || mutating || loading}
                        >
                            {t('settings.dictionaryBrowser.deleteSelected')}
                        </Button>
                        <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
                            <DialogContent>
                                <Typography>
                                    {t('settings.dictionaryBrowser.confirmDeleteSelected', {
                                        count: selectedCount,
                                    })}
                                </Typography>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setConfirmDeleteOpen(false)}>{t('action.cancel')}</Button>
                                <Button color="error" onClick={() => void handleDeleteSelected()}>
                                    {t('action.delete')}
                                </Button>
                            </DialogActions>
                        </Dialog>
                    </Stack>
                    <TableContainer
                        component={Paper}
                        variant="outlined"
                        sx={{ maxHeight: fullScreen ? '60vh' : '55vh' }}
                    >
                        <Table stickyHeader size="small">
                            <TableHead
                                sx={{
                                    '& .MuiTableCell-head': {
                                        borderBottom: 0,
                                        backgroundColor: theme.palette.background.paper,
                                    },
                                    '& .MuiTableRow-root:first-of-type .MuiTableCell-head': {
                                        top: 0,
                                        zIndex: 3,
                                        height: 40,
                                        boxSizing: 'border-box',
                                    },
                                    '& .MuiTableRow-root:nth-of-type(2) .MuiTableCell-head': {
                                        top: 40,
                                        zIndex: 2,
                                    },
                                }}
                            >
                                <TableRow sx={{ boxShadow: `inset 0 -1px 0 ${theme.palette.divider}` }}>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={allVisibleSelected}
                                            indeterminate={partiallyVisibleSelected}
                                            onChange={toggleSelectAllVisible}
                                            disabled={!visibleSelectableRows.length}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {renderSortableHeader('token', t('settings.dictionaryBrowser.columns.word'))}
                                    </TableCell>
                                    <TableCell>
                                        {renderSortableHeader('lemmas', t('settings.dictionaryBrowser.columns.lemmas'))}
                                    </TableCell>
                                    <TableCell>
                                        {renderSortableHeader('source', t('settings.dictionaryBrowser.columns.source'))}
                                    </TableCell>
                                    <TableCell>
                                        {renderSortableHeader('status', t('settings.dictionaryBrowser.columns.status'))}
                                    </TableCell>
                                    <TableCell>
                                        {renderSortableHeader('states', t('settings.dictionaryBrowser.columns.states'))}
                                    </TableCell>
                                    <TableCell>
                                        {renderSortableHeader('track', t('settings.dictionaryBrowser.columns.track'))}
                                    </TableCell>
                                    <TableCell>
                                        {renderSortableHeader(
                                            'cardIds',
                                            t('settings.dictionaryBrowser.columns.cardIds')
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {renderSortableHeader(
                                            'noteIds',
                                            t('settings.dictionaryBrowser.columns.noteIds')
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {renderSortableHeader(
                                            'suspended',
                                            t('settings.dictionaryBrowser.columns.suspended')
                                        )}
                                    </TableCell>
                                </TableRow>
                                <TableRow sx={{ boxShadow: `inset 0 -1px 0 ${theme.palette.divider}` }}>
                                    <TableCell padding="checkbox" />
                                    <TableCell colSpan={2}>
                                        <TextField
                                            placeholder={t('settings.dictionaryBrowser.searchPlaceholder')}
                                            value={draftViewCriteria.searchQuery}
                                            onChange={(event) =>
                                                updateDraftTextCriteria('searchQuery', event.target.value)
                                            }
                                            slotProps={{
                                                input: {
                                                    endAdornment: renderClearAdornment(
                                                        draftViewCriteria.searchQuery,
                                                        () => clearDraftTextCriteria('searchQuery')
                                                    ),
                                                },
                                            }}
                                            size="small"
                                            fullWidth
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <CyclingFilterSelect
                                            options={filterableSources}
                                            selectedFilters={draftViewCriteria.selectedSourceFilters}
                                            placeholder={t('settings.dictionaryBrowser.columns.source')}
                                            onToggle={(source) => cycleFilter('selectedSourceFilters', source)}
                                            renderSelectedValue={(source) => renderSourceFilterLabel(source)}
                                            renderMenuItemLabel={(source) => (
                                                <ListItemText primary={sourceLabels[source]} />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <CyclingFilterSelect
                                            options={filterStatusOptions}
                                            selectedFilters={draftViewCriteria.selectedStatusFilters}
                                            placeholder={t('settings.dictionaryBrowser.columns.status')}
                                            onToggle={(status) => cycleFilter('selectedStatusFilters', status)}
                                            renderSelectedValue={(status, index) => (
                                                <Typography
                                                    key={`${status}-${index}`}
                                                    component="span"
                                                    sx={{ color: statusColors[status], fontWeight: 500 }}
                                                >
                                                    {index > 0 ? ', ' : ''}
                                                    {renderStatusFilterLabel(status)}
                                                </Typography>
                                            )}
                                            renderMenuItemLabel={(status) => (
                                                <ListItemText
                                                    primary={t(`settings.dictionaryTokenStatus${status}`)}
                                                    slotProps={{ primary: { sx: { color: statusColors[status] } } }}
                                                />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <CyclingFilterSelect
                                            options={filterableStates}
                                            selectedFilters={draftViewCriteria.selectedStateFilters}
                                            placeholder={t('settings.dictionaryBrowser.columns.states')}
                                            onToggle={(state) => cycleFilter('selectedStateFilters', state)}
                                            renderSelectedValue={(state) => renderStateFilterLabel(state)}
                                            renderMenuItemLabel={(state) => (
                                                <ListItemText primary={stateLabels[state]} />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <CyclingFilterSelect
                                            options={trackFilterOptions.map((option) => option.value)}
                                            selectedFilters={draftViewCriteria.selectedTrackFilters}
                                            placeholder={t('settings.dictionaryBrowser.columns.track')}
                                            onToggle={(trackValue) => cycleFilter('selectedTrackFilters', trackValue)}
                                            renderSelectedValue={(trackValue) => renderTrackFilterLabel(trackValue)}
                                            renderMenuItemLabel={(trackValue) => (
                                                <ListItemText
                                                    primary={
                                                        trackFilterOptions.find((option) => option.value === trackValue)
                                                            ?.label ?? ''
                                                    }
                                                />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            placeholder={t('settings.dictionaryBrowser.columns.cardIds')}
                                            value={draftViewCriteria.cardIdFilter}
                                            onChange={(event) =>
                                                updateDraftTextCriteria('cardIdFilter', event.target.value)
                                            }
                                            slotProps={{
                                                input: {
                                                    endAdornment: renderClearAdornment(
                                                        draftViewCriteria.cardIdFilter,
                                                        () => clearDraftTextCriteria('cardIdFilter')
                                                    ),
                                                },
                                            }}
                                            size="small"
                                            fullWidth
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            placeholder={t('settings.dictionaryBrowser.columns.noteIds')}
                                            value={draftViewCriteria.noteIdFilter}
                                            onChange={(event) =>
                                                updateDraftTextCriteria('noteIdFilter', event.target.value)
                                            }
                                            slotProps={{
                                                input: {
                                                    endAdornment: renderClearAdornment(
                                                        draftViewCriteria.noteIdFilter,
                                                        () => clearDraftTextCriteria('noteIdFilter')
                                                    ),
                                                },
                                            }}
                                            size="small"
                                            fullWidth
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormControl size="small" fullWidth>
                                            <Select
                                                value={draftViewCriteria.suspendedFilter}
                                                onChange={(event) =>
                                                    updateDraftViewCriteria(
                                                        singleSelectAutoRefreshDelayMs,
                                                        (current) => ({
                                                            ...current,
                                                            suspendedFilter: event.target.value as SuspendedFilter,
                                                        })
                                                    )
                                                }
                                            >
                                                <MenuItem value="all">
                                                    {t('settings.dictionaryBrowser.suspended.all')}
                                                </MenuItem>
                                                <MenuItem value="yes">
                                                    {t('settings.dictionaryBrowser.suspended.yes')}
                                                </MenuItem>
                                                <MenuItem value="no">
                                                    {t('settings.dictionaryBrowser.suspended.no')}
                                                </MenuItem>
                                                <MenuItem value="mixed">
                                                    {t('settings.dictionaryBrowser.suspended.mixed')}
                                                </MenuItem>
                                            </Select>
                                        </FormControl>
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {visibleRows.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={10}>
                                            <Typography color="text.secondary">
                                                {t('settings.dictionaryBrowser.noResults')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {visibleRows.map((row) => (
                                    <WordBrowserTableRow
                                        key={row.selectionKey}
                                        row={row}
                                        selected={selectedRowKeys.has(row.selectionKey)}
                                        onSelectRow={handleSelectRow}
                                        renderStatusLabel={renderStatusLabel}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={mutating}>
                    {t('action.close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
