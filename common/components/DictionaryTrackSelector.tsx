import React from 'react';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';

const maxTracks = 3;

interface Props {
    track: number;
    onTrackSelected: (track: number) => void;
}

export default function DictionaryTrackSelector({ track, onTrackSelected }: Props) {
    const { t } = useTranslation();

    return (
        <TextField
            select
            fullWidth
            color="primary"
            variant="outlined"
            size="small"
            label={t('settings.dictionaryTrack')!}
            value={track}
            onChange={(e) => onTrackSelected(Number(e.target.value))}
        >
            {[...Array(maxTracks).keys()].map((i) => (
                <MenuItem key={i} value={i}>
                    {t('settings.dictionaryTrackChoice', { trackNumber: i + 1 })}
                </MenuItem>
            ))}
        </TextField>
    );
}
