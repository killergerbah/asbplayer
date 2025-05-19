import { makeStyles } from '@mui/styles';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import React from 'react';
import Typography from '@mui/material/Typography';
import Fade from '@mui/material/Fade';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import videoUrl from '/assets/tutorial.mp4';
import TabRegistry from '@/services/tab-registry';
import { SettingsProvider } from '@project/common/settings';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import { isMobile } from 'react-device-detect';
import DialogContent from '@mui/material/DialogContent';
import { DialogActions, IconButton, useMediaQuery } from '@mui/material';
import { Trans, useTranslation } from 'react-i18next';
import Link from '@mui/material/Link';
import { PlayArrow } from '@mui/icons-material';

const useBubbleStyles = makeStyles({
    all: { background: 'rgba(70, 70, 70, 1)' },
});

interface BubbleProps extends React.HTMLProps<HTMLDivElement> {
    tailSide: 'top' | 'right';
    tailRight?: number | string;
    tailLeft?: number | string;
    tailTop?: number | string;
    tailBottom?: number | string;
    show: boolean;
    onConfirm?: () => void;
}

const settingsProvider = new SettingsProvider(new ExtensionSettingsStorage());
const tabRegistry = new TabRegistry(settingsProvider);
const zIndexTop = 2147483648;

const Bubble = React.forwardRef<HTMLDivElement, BubbleProps>(
    ({ tailSide, tailRight, tailLeft, tailTop, tailBottom, show, onConfirm, style, children }: BubbleProps, ref) => {
        const classes = useBubbleStyles();
        let tailPosition: React.CSSProperties = {};

        if (tailSide === 'top') {
            tailPosition = {
                top: 11,
                right: tailRight,
                left: tailLeft,
                transform: 'rotate(30deg) skewY(30deg)',
            };
        } else if (tailSide === 'right') {
            tailPosition = {
                right: -5,
                top: tailTop,
                bottom: tailBottom,
                transform: 'rotate(120deg) skewY(30deg)',
            };
        }
        return (
            <Fade in={show}>
                <div ref={ref} style={{ zIndex: zIndexTop, ...style }}>
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <div
                            className={classes.all}
                            style={{
                                position: 'absolute',
                                aspectRatio: '1',
                                width: 20,
                                ...tailPosition,
                            }}
                        />
                        <Box
                            className={classes.all}
                            p={2}
                            sx={{
                                position: 'absolute',
                                top: 20,
                                left: 0,
                                maxWidth: '100%',
                                borderRadius: '16px',
                            }}
                        >
                            <Stack spacing={1}>
                                <Typography variant="subtitle1">{children}</Typography>
                                {onConfirm && (
                                    <Button variant="contained" onClick={onConfirm} fullWidth>
                                        Got it
                                    </Button>
                                )}
                            </Stack>
                        </Box>
                    </div>
                </div>
            </Fade>
        );
    }
);

const useExtensionState = () => {
    const [sidePanelOpen, setSidePanelOpen] = useState<boolean>();
    const [loadedSubtitles, setLoadedSubtitles] = useState<boolean>();
    const [currentTabId, setCurrentTabId] = useState<number>();
    useEffect(() => {
        browser.tabs.getCurrent().then((t) => setCurrentTabId(t?.id));
    }, []);
    useEffect(() => {
        const interval = setInterval(() => {
            tabRegistry
                .findAsbplayer({
                    filter: (asbplayer) => asbplayer.sidePanel ?? false,
                    allowTabCreation: false,
                })
                .then((asbplayer) => setSidePanelOpen(asbplayer !== undefined));

            tabRegistry.activeVideoElements().then((elems) => {
                const currentElemIsSynced = elems.find((elem) => elem.id === currentTabId && elem.synced) !== undefined;
                setLoadedSubtitles(currentElemIsSynced);
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [currentTabId]);
    return { sidePanelOpen, loadedSubtitles };
};

enum Step {
    toolbar = 1,
    loadSubtitles = 2,
    sidePanel = 3,
    overlay = 4,
    overlayScrollControl = 5,
    almostDone = 6,
    done = 7,
}

const LoadSubtitlesDialog: React.FC<{ open: boolean }> = ({ open }) => {
    return (
        <Dialog open={open}>
            <DialogTitle>Load subtitles</DialogTitle>
            <DialogContent>
                {!isMobile && (
                    <Trans
                        i18nKey="ftue.loadSubtitles"
                        components={[
                            <b key={0}>Side Panel</b>,
                            <p key={1} />,
                            <b key={2}>Side Panel</b>,
                            <b key={3}>Popup</b>,
                        ]}
                    />
                )}
                {isMobile && (
                    <Trans
                        i18nKey="ftue.loadSubtitlesMobile"
                        components={[<b key={0}>asbplayer</b>, <b key={1}>extensions</b>]}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
};

const FinishedDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
    return (
        <Dialog open={open} style={{ zIndex: zIndexTop }}>
            <DialogTitle>Congratulations</DialogTitle>
            <DialogContent>
                <Trans
                    i18nKey={'ftue.congrats'}
                    components={[
                        <Link href="/options.html#about" target="_blank" rel="noreferrer" key={0}>
                            Settings
                        </Link>,
                        <p key={1} />,
                        <Link
                            href="https://github.com/killergerbah/asbplayer?tab=readme-ov-file#getting-started"
                            target="_blank"
                            rel="noreferrer"
                            key={2}
                        >
                            user guide
                        </Link>,
                    ]}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>OK</Button>
            </DialogActions>
        </Dialog>
    );
};

const Tutorial: React.FC<{ className: string; show: boolean }> = ({ className, show }) => {
    const { sidePanelOpen, loadedSubtitles } = useExtensionState();
    const [step, setStep] = useState<Step>(Step.toolbar);

    useEffect(() => {
        if (step === Step.toolbar && isMobile) {
            setStep(Step.loadSubtitles);
        }
    }, [step]);

    useEffect(() => {
        if (step === Step.loadSubtitles && loadedSubtitles) {
            setStep(sidePanelOpen ? Step.sidePanel : Step.overlay);
        }
    }, [step, loadedSubtitles]);

    useEffect(() => {
        if (step == Step.overlay) {
            settingsProvider.getSingle('streamingEnableOverlay').then((overlayEnabled) => {
                if (overlayEnabled) {
                    videoRef.current?.pause();
                } else {
                    setStep(Step.almostDone);
                }
            });
        }
    }, [step]);

    const [playing, setPlaying] = useState<boolean>(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleVideoClick = () => {
        if (playing) {
            videoRef.current?.pause();
        } else {
            videoRef.current?.play();
        }
    };

    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

    return (
        <Paper square sx={{ position: 'relative' }} className={className}>
            {show && (
                <Fade in={true}>
                    <Box
                        sx={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <div style={{ width: isSmallScreen ? '100%' : '80%' }}>
                            <div style={{ position: 'relative' }}>
                                <video
                                    ref={videoRef}
                                    onPlay={() => setPlaying(true)}
                                    onPause={() => setPlaying(false)}
                                    style={{ width: '100%' }}
                                    src={videoUrl}
                                    onClick={handleVideoClick}
                                />
                                <div
                                    style={{
                                        position: 'absolute',
                                        transform: 'translateY(-50%) translateX(-50%) scale(400%)',
                                        top: '50%',
                                        left: '50%',
                                    }}
                                >
                                    {!playing && (
                                        <IconButton onClick={() => videoRef.current?.play()}>
                                            <PlayArrow />
                                        </IconButton>
                                    )}
                                </div>
                                <Bubble
                                    show={show && step === Step.overlay}
                                    tailSide="top"
                                    tailLeft="25%"
                                    style={{
                                        position: 'absolute',
                                        top: 55,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: 250,
                                    }}
                                    onConfirm={() => setStep(Step.overlayScrollControl)}
                                >
                                    <Trans
                                        i18nKey="ftue.overlay"
                                        components={[
                                            <b key={0}>Video Overlay</b>,
                                            <b key={1}>toggle</b>,
                                            <b key={2}>mine</b>,
                                            <b key={3}>switch playback modes</b>,
                                        ]}
                                    />
                                </Bubble>
                                <Bubble
                                    show={show && step === Step.overlayScrollControl}
                                    tailSide="top"
                                    tailRight="15%"
                                    style={{
                                        position: 'absolute',
                                        top: 55,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: 250,
                                    }}
                                    onConfirm={() => setStep(Step.almostDone)}
                                >
                                    <Trans
                                        i18nKey={'ftue.overlayScroll'}
                                        components={[
                                            <b key={0}>Scroll</b>,
                                            <b key={1}>subtitle navigation</b>,
                                            <b key={2}>subtitle offset</b>,
                                            <b key={3}>playback rate</b>,
                                        ]}
                                    />
                                </Bubble>
                            </div>
                        </div>
                    </Box>
                </Fade>
            )}
            <Bubble
                show={show && step === Step.toolbar}
                tailSide="top"
                tailRight={70}
                style={{ position: 'absolute', right: 30, top: 5, width: 250 }}
                onConfirm={() => setStep(Step.loadSubtitles)}
            >
                <Trans
                    i18nKey="ftue.toolbar"
                    components={[<b key={0}>asbplayer</b>, <b key={1}>Popup</b>, <p key={2} />]}
                />
            </Bubble>
            <Bubble
                show={show && step === Step.sidePanel}
                tailSide="right"
                tailTop={50}
                style={{ position: 'absolute', right: 30, top: '10%', width: 250 }}
                onConfirm={() => setStep(Step.overlay)}
            >
                <Trans
                    i18nKey="ftue.sidePanel"
                    components={[<b key={0}>Side Panel</b>, <b key={1}>navigate</b>, <b key={2}>mine</b>]}
                />
            </Bubble>

            <LoadSubtitlesDialog open={show && step === Step.loadSubtitles} />
            <FinishedDialog open={show && step === Step.almostDone} onClose={() => setStep(Step.done)} />
        </Paper>
    );
};

export default Tutorial;
