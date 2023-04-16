import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Anki,
    Image,
    ImageModel,
    AudioClip,
    AudioModel,
    SubtitleModel,
    AnkiDialogSliderContext,
    AnkiSettings,
    AnkiUiState,
    AnkiUiInitialState,
    AnkiUiResumeState,
    AnkiUiSavedState,
    AnkiUiBridgeRerecordMessage,
    AnkiUiBridgeResumeMessage,
    AnkiUiBridgeRewindMessage,
    CopyToClipboardMessage,
} from '@project/common';
import { createTheme } from './theme';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import Alert, { Color } from '@material-ui/lab/Alert';
import CssBaseline from '@material-ui/core/CssBaseline';
import { AnkiDialog, ImageDialog } from '@project/common/components';
import Snackbar from '@material-ui/core/Snackbar';
import Bridge from '../bridge';
import { PaletteType } from '@material-ui/core';
import { AnkiExportMode } from '@project/common/src/anki';
import { AnkiDialogState } from '@project/common/components';
import './i18n';

interface Props {
    bridge: Bridge;
    mp3WorkerUrl: string;
}

const blobToDataUrl = async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result as string);
        };
        reader.readAsDataURL(blob);
    });
};

export default function AnkiUi({ bridge, mp3WorkerUrl }: Props) {
    const [open, setOpen] = useState<boolean>(false);
    const [disabled, setDisabled] = useState<boolean>(false);
    const [subtitle, setSubtitle] = useState<SubtitleModel>();
    const [text, setText] = useState<string>();
    const [audioClip, setAudioClip] = useState<AudioClip>();
    const [serializedAudio, setSerializedAudio] = useState<AudioModel>();
    const [image, setImage] = useState<Image>();
    const [serializedImage, setSerializedImage] = useState<ImageModel>();
    const [imageDialogOpen, setImageDialogOpen] = useState<boolean>(false);
    const [source, setSource] = useState<string>('');
    const [url, setUrl] = useState<string>('');
    const [sliderContext, setSliderContext] = useState<AnkiDialogSliderContext>();
    const [definition, setDefinition] = useState('');
    const [word, setWord] = useState('');
    const [customFieldValues, setCustomFieldValues] = useState<{ [key: string]: string }>({});
    const [initialTimestampInterval, setInitialTimestampInterval] = useState<number[]>();
    const [timestampInterval, setTimestampInterval] = useState<number[]>();
    const [timestampBoundaryInterval, setTimestampBoundaryInterval] = useState<number[]>();
    const [lastAppliedTimestampIntervalToText, setLastAppliedTimestampIntervalToText] = useState<number[]>();
    const [lastAppliedTimestampIntervalToAudio, setLastAppliedTimestampIntervalToAudio] = useState<number[]>();
    const [settingsProvider, setSettingsProvider] = useState<AnkiSettings>();
    const [alertSeverity, setAlertSeverity] = useState<Color>('error');
    const [alertOpen, setAlertOpen] = useState<boolean>(false);
    const [alert, setAlert] = useState<string>('');
    const [themeType, setThemeType] = useState<string>('dark');
    const [dialogRequestedTimestamp, setDialogRequestedTimestamp] = useState<number>(0);

    const theme = useMemo(() => createTheme(themeType as PaletteType), [themeType]);
    const anki = useMemo(
        () => (settingsProvider ? new Anki(settingsProvider, bridge) : undefined),
        [settingsProvider, bridge]
    );
    const dialogStateRef = useRef<AnkiDialogState>();

    const savedState = useCallback(() => {
        const dialogState = dialogStateRef.current!;
        const savedState: AnkiUiSavedState = {
            subtitle: subtitle!,
            text: dialogState.text,
            sliderContext: dialogState.sliderContext!,
            definition: dialogState.definition,
            image: serializedImage,
            audio: serializedAudio,
            word: dialogState.word,
            source: dialogState.source,
            url: dialogState.url,
            customFieldValues: dialogState.customFieldValues,
            initialTimestampInterval: dialogState.initialTimestampInterval!,
            timestampInterval: dialogState.timestampInterval!,
            timestampBoundaryInterval: dialogState.timestampBoundaryInterval,
            lastAppliedTimestampIntervalToText: dialogState.lastAppliedTimestampIntervalToText!,
            lastAppliedTimestampIntervalToAudio: dialogState.lastAppliedTimestampIntervalToAudio,
            dialogRequestedTimestamp: dialogRequestedTimestamp,
        };
        return savedState;
    }, [subtitle, serializedImage, serializedAudio, dialogRequestedTimestamp]);

    useEffect(() => {
        return bridge.onStateUpdated((s: AnkiUiState) => {
            let audioClip;

            if (s.audio) {
                let start: number;
                let end: number;

                if (s.audio.start !== undefined && s.audio.end !== undefined) {
                    start = Math.max(0, s.audio.start! - s.audio.paddingStart);
                    end = s.audio.end! + s.audio.paddingEnd;
                } else {
                    start = Math.max(0, s.subtitle.start - s.audio.paddingStart);
                    end = s.subtitle.end + s.audio.paddingEnd;
                }

                audioClip = AudioClip.fromBase64(
                    s.source,
                    start,
                    end,
                    s.audio.playbackRate ?? 1,
                    s.audio.base64,
                    s.audio.extension
                );
            }

            if (audioClip && s.settingsProvider.preferMp3) {
                audioClip = audioClip.toMp3(() => new Worker(mp3WorkerUrl));
            }

            let image;

            if (s.image) {
                image = Image.fromBase64(s.source, s.subtitle.start, s.image.base64, s.image.extension);
            }

            if (s.type === 'initial') {
                const state = s as AnkiUiInitialState;
                const sliderContext = {
                    subtitleStart: state.subtitle.start,
                    subtitleEnd: state.subtitle.end,
                    subtitles: state.surroundingSubtitles || [
                        {
                            start: state.subtitle.start,
                            end: state.subtitle.end,
                            text: state.subtitle.text,
                            track: state.subtitle.track,
                        },
                    ],
                };
                setText(undefined);
                setTimestampInterval(
                    (s.audio?.start && s.audio?.end && [s.audio.start, s.audio.end]) ||
                        (sliderContext && [sliderContext.subtitleStart, sliderContext.subtitleEnd]) ||
                        undefined
                );
                setTimestampBoundaryInterval(undefined);
                setInitialTimestampInterval(undefined);
                setSliderContext(sliderContext);
                setDefinition('');
                setWord('');
                setCustomFieldValues({});
                setLastAppliedTimestampIntervalToText(undefined);
                setLastAppliedTimestampIntervalToAudio(undefined);
            } else if (s.type === 'resume') {
                const state = s as AnkiUiResumeState;
                setText(state.text);
                setInitialTimestampInterval(state.initialTimestampInterval);
                setTimestampInterval(state.timestampInterval);
                setTimestampBoundaryInterval(state.timestampBoundaryInterval);
                setSliderContext(state.sliderContext);
                setDefinition(state.definition);
                setWord(state.word);
                setCustomFieldValues(state.customFieldValues);
                setLastAppliedTimestampIntervalToText(state.lastAppliedTimestampIntervalToText);
                setLastAppliedTimestampIntervalToAudio(state.lastAppliedTimestampIntervalToAudio);
            }

            setSubtitle(s.subtitle);
            setSource(s.source);
            setUrl(s.url);
            setDialogRequestedTimestamp(s.dialogRequestedTimestamp);
            setSerializedAudio(s.audio);
            setSerializedImage(s.image);
            setImageDialogOpen(false);
            setDisabled(false);
            setSettingsProvider(s.settingsProvider);
            setAudioClip(audioClip);
            setImage(image);
            setThemeType(s.themeType || 'dark');
            setOpen(s.open);
        });
    }, [bridge, mp3WorkerUrl]);

    const handleProceed = useCallback(
        async (
            text: string,
            definition: string,
            audioClip: AudioClip | undefined,
            image: Image | undefined,
            word: string,
            source: string,
            url: string,
            customFieldValues: { [key: string]: string },
            tags: string[],
            mode: AnkiExportMode
        ) => {
            setDisabled(true);

            try {
                await anki!.export(
                    text,
                    definition,
                    audioClip,
                    image,
                    word,
                    source,
                    url,
                    customFieldValues,
                    tags,
                    mode
                );

                if (mode !== 'gui') {
                    setOpen(false);
                    setImageDialogOpen(false);
                    const message: AnkiUiBridgeResumeMessage = {
                        command: 'resume',
                        uiState: savedState(),
                        cardExported: true,
                    };
                    bridge.sendServerMessage(message);
                }
            } catch (e) {
                console.error(e);
                setAlertSeverity('error');

                if (e instanceof Error) {
                    setAlert((e as Error).message);
                } else {
                    setAlert(String(e));
                }

                setAlertOpen(true);
            } finally {
                setDisabled(false);
            }
        },
        [anki, bridge, savedState]
    );

    const handleCancel = useCallback(() => {
        setOpen(false);
        setImageDialogOpen(false);
        const message: AnkiUiBridgeResumeMessage = { command: 'resume', uiState: savedState(), cardExported: false };
        bridge.sendServerMessage(message);
    }, [bridge, savedState]);

    const handleRewind = useCallback(() => {
        setOpen(false);
        setImageDialogOpen(false);
        const message: AnkiUiBridgeRewindMessage = { command: 'rewind', uiState: savedState() };
        bridge.sendServerMessage(message);
    }, [bridge, savedState]);

    const handleViewImage = useCallback((image: Image) => {
        setImage(image);
        setImageDialogOpen(true);
    }, []);

    const handleRerecord = useCallback(() => {
        setOpen(false);
        setImageDialogOpen(false);

        const state = savedState();
        const message: AnkiUiBridgeRerecordMessage = {
            command: 'rerecord',
            uiState: state,
            recordStart: state.timestampInterval![0],
            recordEnd: state.timestampInterval![1],
        };

        bridge.sendServerMessage(message);
    }, [bridge, savedState]);

    const handleOpenSettings = useCallback(() => {
        bridge.sendServerMessage({ command: 'openSettings' });
    }, [bridge]);

    const lastFocusOutRef = useRef<HTMLElement>();

    const handleFocusOut = useCallback((event: FocusEvent) => {
        if (event.target instanceof HTMLElement) {
            lastFocusOutRef.current = event.target;
        }
    }, []);

    const handleCopyToClipboard = useCallback(async (blob: Blob) => {
        const message: CopyToClipboardMessage = { command: 'copy-to-clipboard', dataUrl: await blobToDataUrl(blob) };
        bridge.sendServerMessage(message);
    }, []);

    useEffect(() => {
        return bridge.onClientMessage((message) => {
            if (message.command === 'focus') {
                lastFocusOutRef.current?.focus();
            } else if (message.command === 'ankiSettings') {
                setSettingsProvider(message.value);
            }
        });
    }, [bridge]);

    useEffect(() => {
        if (open) {
            window.removeEventListener('focusout', handleFocusOut);
            window.addEventListener('focusout', handleFocusOut);
        } else {
            window.removeEventListener('focusout', handleFocusOut);
        }
    }, [open, handleFocusOut]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Snackbar
                anchorOrigin={{ horizontal: 'center', vertical: 'top' }}
                open={alertOpen}
                autoHideDuration={5000}
                onClose={() => setAlertOpen(false)}
            >
                <Alert onClose={() => setAlertOpen(false)} severity={alertSeverity}>
                    {alert}
                </Alert>
            </Snackbar>
            <ImageDialog open={imageDialogOpen} image={image} onClose={() => setImageDialogOpen(false)} />
            {sliderContext && settingsProvider && anki && (
                <AnkiDialog
                    open={open}
                    disabled={disabled}
                    text={text}
                    sliderContext={sliderContext}
                    audioClip={audioClip}
                    image={image}
                    source={source}
                    url={url}
                    settingsProvider={settingsProvider}
                    anki={anki}
                    onProceed={handleProceed}
                    onRewind={handleRewind}
                    onRerecord={handleRerecord}
                    onCancel={handleCancel}
                    onViewImage={handleViewImage}
                    onOpenSettings={handleOpenSettings}
                    onCopyToClipboard={handleCopyToClipboard}
                    definition={definition}
                    word={word}
                    customFields={settingsProvider.customAnkiFields}
                    customFieldValues={customFieldValues}
                    initialTimestampInterval={initialTimestampInterval}
                    timestampBoundaryInterval={timestampBoundaryInterval}
                    timestampInterval={timestampInterval}
                    lastAppliedTimestampIntervalToText={lastAppliedTimestampIntervalToText}
                    lastAppliedTimestampIntervalToAudio={lastAppliedTimestampIntervalToAudio}
                    stateRef={dialogStateRef}
                />
            )}
        </ThemeProvider>
    );
}
