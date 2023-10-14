import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { AsbPlayerToTabCommand, LoadSubtitlesMessage, VideoTabModel } from '@project/common';
import { ChromeExtension } from '@project/common/app';
import { t } from 'i18next';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
    extension: ChromeExtension;
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

const CenteredGridItem = ({ children, ...props }: { children: React.ReactNode }) => {
    return (
        <Grid item alignContent="center" justifyContent="center" style={{ textAlign: 'center' }} {...props}>
            {children}
        </Grid>
    );
};

const CenteredGridContainer = ({ children, ...props }: { children: React.ReactNode }) => {
    return (
        <Grid
            container
            style={{ width: '100%', height: '100%' }}
            alignContent="center"
            justifyContent="center"
            {...props}
        >
            {children}
        </Grid>
    );
};

const SidePanelHome = ({ extension }: Props) => {
    const [videoElementCount, setVideoElementCount] = useState<number>();
    const [currentTabId, setCurrentTabId] = useState<number>();

    useEffect(() => {
        const countInCurrentTab = (tabs: VideoTabModel[]) => tabs.filter((t) => t.id === currentTabId).length;

        if (extension.tabs !== undefined) {
            setVideoElementCount(countInCurrentTab(extension.tabs));
        }

        return extension.subscribeTabs((tabs) => {
            setVideoElementCount(countInCurrentTab(tabs));
        });
    }, [extension, currentTabId]);

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            if (tabs.length > 0) {
                setCurrentTabId(tabs[0].id);
            }
        });
    }, []);

    useEffect(() => {
        const listener = (info: chrome.tabs.TabActiveInfo) => setCurrentTabId(info.tabId);
        chrome.tabs.onActivated.addListener(listener);
        return () => chrome.tabs.onActivated.removeListener(listener);
    });

    const handleLoadSubtitles = useCallback(() => {
        if (currentTabId === undefined) {
            return;
        }

        const message: AsbPlayerToTabCommand<LoadSubtitlesMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'load-subtitles' },
            tabId: currentTabId,
        };
        chrome.runtime.sendMessage(message);
    }, [currentTabId]);

    if (videoElementCount === undefined) {
        return (
            <CenteredGridContainer>
                <CenteredGridItem>
                    <CircularProgress color="secondary" />
                </CenteredGridItem>
            </CenteredGridContainer>
        );
    }

    return (
        <CenteredGridContainer>
            <CenteredGridItem>
                <VideoElementInfoText videoElementCount={videoElementCount} />
            </CenteredGridItem>
            <CenteredGridItem>
                <Button
                    variant="contained"
                    color="secondary"
                    disabled={videoElementCount === 0}
                    onClick={handleLoadSubtitles}
                >
                    {t('action.loadSubtitles')}
                </Button>
            </CenteredGridItem>
        </CenteredGridContainer>
    );
};

export default SidePanelHome;
