import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import NoteAddIcon from '@material-ui/icons/NoteAdd';
import { useTranslation } from 'react-i18next';

interface Props {
    disabled: boolean;
    onMineSubtitle: () => void;
}

const SidePanelControls = ({ disabled, onMineSubtitle }: Props) => {
    const { t } = useTranslation();
    return (
        <Box p={2} style={{ position: 'absolute', bottom: 0, width: '100%' }}>
            <Button
                disabled={disabled}
                variant="contained"
                color="secondary"
                startIcon={<NoteAddIcon />}
                onClick={onMineSubtitle}
                style={{ width: '100%' }}
            >
                {t('action.mineSubtitle')}
            </Button>
        </Box>
    );
};

export default SidePanelControls;
