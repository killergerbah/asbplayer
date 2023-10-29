import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import { ChromeExtension } from '@project/common/app';
import { useTranslation } from 'react-i18next';
import CenteredGridItem from './CenteredGridItem';
import CenteredGridContainer from './CenteredGridContainer';
import SubtitlesIcon from '@material-ui/icons/Subtitles';

interface Props {
    extension: ChromeExtension;
    videoElementCount: number;
    onLoadSubtitles: () => void;
}

const VideoElementInfoText = ({ videoElementCount }: { videoElementCount: number }) => {
    const { t } = useTranslation();
    return (
        <Box p={3}>
            <Typography variant="h6">
                {videoElementCount === 0 ? t('landing.noVideoElementsDetected') : t('landing.videoElementsDetected')}
            </Typography>
        </Box>
    );
};

const SidePanelHome = ({ videoElementCount, onLoadSubtitles }: Props) => {
    const { t } = useTranslation();

    return (
        <CenteredGridContainer direction="column">
            <CenteredGridItem>
                <VideoElementInfoText videoElementCount={videoElementCount} />
            </CenteredGridItem>
            <CenteredGridItem>
                <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<SubtitlesIcon />}
                    disabled={videoElementCount === 0}
                    onClick={onLoadSubtitles}
                >
                    {t('action.loadSubtitles')}
                </Button>
            </CenteredGridItem>
        </CenteredGridContainer>
    );
};

export default SidePanelHome;
