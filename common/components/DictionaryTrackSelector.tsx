import MenuItem from '@mui/material/MenuItem';
import { useTranslation } from 'react-i18next';
import { NUM_DICTIONARY_TRACKS } from '@project/common/settings';
import SettingsTextField from './SettingsTextField';
interface Props {
    track: number;
    onTrackSelected: (track: number) => void;
}

export default function DictionaryTrackSelector({ track, onTrackSelected }: Props) {
    const { t } = useTranslation();

    return (
        <SettingsTextField
            select
            fullWidth
            color="primary"
            variant="outlined"
            size="small"
            label={t('settings.dictionaryTrack')!}
            value={track}
            onChange={(e) => onTrackSelected(Number(e.target.value))}
        >
            {[...Array(NUM_DICTIONARY_TRACKS).keys()].map((i) => (
                <MenuItem key={i} value={i}>
                    {t('settings.dictionaryTrackChoice', { trackNumber: i + 1 })}
                </MenuItem>
            ))}
        </SettingsTextField>
    );
}
