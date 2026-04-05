import Drawer from './Drawer';
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
    return (
        <Drawer open={open} showBackButton={showBackButton} drawerWidth={drawerWidth} onClose={onClose}>
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
