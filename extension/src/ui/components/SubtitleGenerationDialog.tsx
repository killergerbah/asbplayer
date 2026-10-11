import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useEffect, useMemo, useState } from 'react';
import type { SubtitleGenerationUiState, WhisperOptionSchema, WhisperOptionValue } from '@project/common';
import { useTranslation } from 'react-i18next';

interface Props {
    open: boolean;
    generation: SubtitleGenerationUiState;
    onStart: (options: Record<string, WhisperOptionValue>) => void;
    onClose: () => void;
}

const optionValue = (value: string, type: 'string' | 'number' | 'boolean'): WhisperOptionValue => {
    if (type === 'number') return value === '' ? null : Number(value);
    return value;
};

/** The editable Whisper configuration shown before a subtitle job begins. */
export default function SubtitleGenerationDialog({ open, generation, onStart, onClose }: Props) {
    const { t } = useTranslation();
    const [options, setOptions] = useState<Record<string, WhisperOptionValue>>({});
    const groupedAdvancedOptions = useMemo(() => {
        const groups = new Map<string, WhisperOptionSchema[]>();
        for (const option of generation.capabilities?.options.filter((option) => option.name !== 'model') ?? []) {
            groups.set(option.group, [...(groups.get(option.group) ?? []), option]);
        }
        return [...groups.entries()];
    }, [generation.capabilities]);
    const modelOption = generation.capabilities?.options.find((option) => option.name === 'model');

    useEffect(() => {
        if (!generation.capabilities) return;
        setOptions(
            Object.fromEntries(generation.capabilities.options.map((option) => [option.name, option.defaultValue]))
        );
    }, [generation.capabilities]);

    const renderOption = (option: WhisperOptionSchema) => (
        <Grid item xs={12} sm={6} key={option.name}>
            {option.type === 'boolean' ? (
                <FormControlLabel
                    label={option.label}
                    control={
                        <Switch
                            checked={Boolean(options[option.name])}
                            onChange={(event) =>
                                setOptions((current) => ({
                                    ...current,
                                    [option.name]: event.target.checked,
                                }))
                            }
                        />
                    }
                />
            ) : (
                <TextField
                    fullWidth
                    select={Boolean(option.choices)}
                    type={option.type === 'number' ? 'number' : 'text'}
                    label={option.label}
                    helperText={option.description}
                    value={options[option.name] ?? ''}
                    onChange={(event) =>
                        setOptions((current) => ({
                            ...current,
                            [option.name]: optionValue(event.target.value, option.type),
                        }))
                    }
                >
                    {option.choices?.map((choice) => (
                        <MenuItem key={String(choice)} value={choice}>
                            {String(choice)}
                        </MenuItem>
                    ))}
                </TextField>
            )}
        </Grid>
    );

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>{t('extension.subtitleGeneration.title')}</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}></DialogContentText>
                {generation.sourceUrl && (
                    <TextField
                        fullWidth
                        disabled
                        label={t('extension.subtitleGeneration.videoUrl')}
                        value={generation.sourceUrl}
                        sx={{ mb: 2 }}
                    />
                )}
                {generation.error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {generation.error}
                    </Alert>
                )}
                {generation.state === 'loading' && (
                    <Alert icon={<CircularProgress size={18} />} severity="info" sx={{ mb: 2 }}>
                        {t('extension.subtitleGeneration.connecting')}
                    </Alert>
                )}
                {modelOption && (
                    <Grid container spacing={2}>
                        {renderOption(modelOption)}
                    </Grid>
                )}
                {groupedAdvancedOptions.length > 0 && (
                    <Accordion disableGutters elevation={0} sx={{ mt: 2, '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>{t('extension.subtitleGeneration.advancedOptions')}</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 0 }}>
                            {groupedAdvancedOptions.map(([group, groupOptions]) => (
                                <section key={group}>
                                    <Divider sx={{ my: 2 }} />
                                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                        {group}
                                    </Typography>
                                    <Grid container spacing={2}>
                                        {groupOptions.map(renderOption)}
                                    </Grid>
                                </section>
                            ))}
                        </AccordionDetails>
                    </Accordion>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('extension.subtitleGeneration.close')}</Button>
                <Button disabled={!generation.capabilities} onClick={() => onStart(options)}>
                    {t('extension.subtitleGeneration.generate')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
