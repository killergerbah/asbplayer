import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Anki,
    Image,
    ImageModel,
    AudioClip,
    AudioModel,
    humanReadableTime,
    SubtitleModel,
    AnkiDialogSliderContext,
    AnkiSettings,
    AnkiUiState,
    AnkiUiInitialState,
    AnkiUiResumeState,
    AnkiUiRerecordState,
} from '@project/common';
import { createTheme } from './theme';
import { ThemeProvider } from '@material-ui/core/styles';
import Alert, { Color } from '@material-ui/lab/Alert';
import AnkiDialog from './AnkiDialog';
import CssBaseline from '@material-ui/core/CssBaseline';
import ImageDialog from './ImageDialog';
import Snackbar from '@material-ui/core/Snackbar';
import Bridge from '../Bridge';

interface Props {
    bridge: Bridge;
    mp3WorkerUrl: string;
}

export default function AnkiUi({ bridge, mp3WorkerUrl }: Props) {
    const [open, setOpen] = useState<boolean>(false);
    const [disabled, setDisabled] = useState<boolean>(false);
    const [id, setId] = useState<string>();
    const [subtitle, setSubtitle] = useState<SubtitleModel>();
    const [text, setText] = useState<string>('');
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
    const [timestampInterval, setTimestampInterval] = useState<number[]>();
    const [lastAppliedTimestampIntervalToText, setLastAppliedTimestampIntervalToText] = useState<number[]>();
    const [settingsProvider, setSettingsProvider] = useState<AnkiSettings>();
    const [alertSeverity, setAlertSeverity] = useState<Color>('error');
    const [alertOpen, setAlertOpen] = useState<boolean>(false);
    const [alert, setAlert] = useState<string>('');
    const [themeType, setThemeType] = useState<string>('dark');
    const theme = useMemo(() => createTheme(themeType), [themeType]);
    const anki = useMemo(
        () => (settingsProvider ? new Anki(settingsProvider, bridge) : undefined),
        [settingsProvider, bridge]
    );

    useEffect(() => {
        return bridge.onStateUpdated((s: AnkiUiState) => {
            let audioClip;

            if (s.type === 'initial') {
                const state = s as AnkiUiInitialState;
                setText(state.subtitle.text);
                setSubtitle(state.subtitle);
                setTimestampInterval(undefined);
                setSliderContext({
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
                });
                setSource(`${state.source} (${humanReadableTime(state.subtitle.start)})`);
                setUrl(state.url);
                setDefinition('');
                setWord('');
                setCustomFieldValues({});
                setLastAppliedTimestampIntervalToText(undefined);

                if (state.audio) {
                    audioClip = AudioClip.fromBase64(
                        state.source,
                        Math.max(0, state.subtitle.start - state.audio.paddingStart),
                        state.subtitle.end + state.audio.paddingEnd,
                        state.audio.base64,
                        state.audio.extension
                    );
                }
            } else if (s.type === 'resume') {
                const state = s as AnkiUiResumeState;
                setText(state.text);
                setTimestampInterval(state.timestampInterval);
                setSliderContext(state.sliderContext);
                setSource(state.source);
                setUrl(state.url);
                setDefinition(state.definition);
                setWord(state.word);
                setCustomFieldValues(state.customFieldValues);
                setLastAppliedTimestampIntervalToText(state.lastAppliedTimestampIntervalToText);

                if (state.audio) {
                    audioClip = AudioClip.fromBase64(
                        state.source,
                        Math.max(0, state.audio.start! - state.audio.paddingStart),
                        state.audio.end! + state.audio.paddingEnd,
                        state.audio.base64,
                        state.audio.extension
                    );
                }
            }

            if (audioClip && s.settingsProvider.preferMp3) {
                audioClip = audioClip.toMp3(() => new Worker(mp3WorkerUrl));
            }

            let image;

            if (s.image) {
                image = Image.fromBase64(s.source, s.subtitle.start, s.image.base64, s.image.extension);
            }

            setSerializedAudio(s.audio);
            setSerializedImage(s.image);
            setImageDialogOpen(false);
            setDisabled(false);
            setSettingsProvider(s.settingsProvider);
            setId(s.id);
            setAudioClip(audioClip);
            setImage(image);
            setThemeType(s.themeType || 'dark');
            setOpen(s.open);
        });
    }, [bridge, mp3WorkerUrl]);

    const handleProceed = useCallback(
        async (text, definition, audioClip, image, word, source, url, customFieldValues, tags, mode) => {
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
                    bridge.finished({ command: 'resume' });
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
        [anki, bridge]
    );

    const handleCancel = useCallback(() => {
        setOpen(false);
        setImageDialogOpen(false);
        bridge.finished({ command: 'resume' });
    }, [bridge]);

    const handleViewImage = useCallback((image) => {
        setImage(image);
        setImageDialogOpen(true);
    }, []);

    const handleRerecord = useCallback(
        ({
            text,
            sliderContext,
            definition,
            word,
            source,
            url,
            customFieldValues,
            timestampInterval,
            lastAppliedTimestampIntervalToText,
        }) => {
            setOpen(false);
            setImageDialogOpen(false);
            const resumeUiState: AnkiUiRerecordState = {
                subtitle: subtitle,
                text: text,
                sliderContext: sliderContext,
                definition: definition,
                image: serializedImage,
                word: word,
                source: source,
                url: url,
                customFieldValues: customFieldValues,
                timestampInterval: timestampInterval,
                lastAppliedTimestampIntervalToText: lastAppliedTimestampIntervalToText,
            };

            bridge.finished({
                command: 'rerecord',
                uiState: resumeUiState,
                id: id,
                recordStart: timestampInterval[0],
                recordEnd: timestampInterval[1],
            });
        },
        [serializedImage, subtitle, id]
    );

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
                    onRerecord={handleRerecord}
                    onCancel={handleCancel}
                    onViewImage={handleViewImage}
                    definition={definition}
                    word={word}
                    customFieldValues={customFieldValues}
                    timestampInterval={timestampInterval}
                    lastAppliedTimestampIntervalToText={lastAppliedTimestampIntervalToText}
                />
            )}
        </ThemeProvider>
    );
}
