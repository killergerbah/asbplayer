import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { DictionaryProvider } from '@project/common/dictionary-db';
import Statistics from '@project/common/components/Statistics';
import { AsbplayerSettings } from '@project/common/settings';

interface Props {
    open: boolean;
    settings: AsbplayerSettings;
    showBackButton: boolean;
    dictionaryProvider: DictionaryProvider;
    onSeekRequested: () => void;
    onMineRequested: () => void;
    onClose: () => void;
}

const SidePanelStatistics: React.FC<Props> = ({
    dictionaryProvider,
    settings,
    open,
    showBackButton,
    onSeekRequested,
    onMineRequested,
    onClose,
}) => {
    const handleViewAnnotationSettings = useCallback(() => {
        browser.tabs.create({
            url: `${browser.runtime.getURL('/options.html')}#annotation`,
            active: true,
        });
    }, []);
    return (
        <Drawer
            variant="persistent"
            anchor="right"
            open={open}
            sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            slotProps={{
                paper: { sx: { width: '100%' } },
            }}
        >
            {showBackButton && (
                <Paper square elevation={0}>
                    <IconButton onClick={onClose}>
                        <ChevronRightIcon />
                    </IconButton>
                </Paper>
            )}
            <Statistics
                dictionaryProvider={dictionaryProvider}
                settings={settings}
                onSeekRequested={onSeekRequested}
                onMineRequested={onMineRequested}
                onViewAnnotationSettings={handleViewAnnotationSettings}
                sx={{ width: '100%', height: '100%' }}
            />
        </Drawer>
    );
};
export default SidePanelStatistics;
