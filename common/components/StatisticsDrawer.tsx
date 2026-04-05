import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { DictionaryProvider } from '@project/common/dictionary-db';
import Statistics from '@project/common/components/Statistics';
import { AsbplayerSettings } from '@project/common/settings';

interface Props {
    open: boolean;
    hasSubtitles: boolean;
    settings: AsbplayerSettings;
    showBackButton: boolean;
    drawerWidth?: number;
    dictionaryProvider: DictionaryProvider;
    onSeekRequested: () => void;
    onMineRequested: () => void;
    onViewAnnotationSettings: () => void;
    onClose: () => void;
}

const StatisticsDrawer: React.FC<Props> = ({
    dictionaryProvider,
    settings,
    open,
    hasSubtitles,
    showBackButton,
    drawerWidth,
    onSeekRequested,
    onMineRequested,
    onViewAnnotationSettings,
    onClose,
}) => {
    const width = drawerWidth === undefined ? '100%' : drawerWidth;
    return (
        <Drawer
            variant="persistent"
            anchor="right"
            open={open}
            sx={{
                height: '100%',
            }}
            slotProps={{
                paper: { sx: { width } },
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
                hasSubtitles={hasSubtitles}
                onSeekRequested={onSeekRequested}
                onMineRequested={onMineRequested}
                onViewAnnotationSettings={onViewAnnotationSettings}
                sx={{ width: '100%', height: '100%' }}
            />
        </Drawer>
    );
};
export default StatisticsDrawer;
