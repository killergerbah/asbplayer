import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Anki, Image, AudioClip } from '@project/common';
import { createTheme } from './theme';
import { ThemeProvider } from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';
import AnkiDialog from './AnkiDialog';
import CssBaseline from '@material-ui/core/CssBaseline';
import ImageDialog from './ImageDialog';
import Snackbar from '@material-ui/core/Snackbar';

export default function AnkiUi({bridge, mp3WorkerUrl}) {
    const [open, setOpen] = useState(false);
    const [disabled, setDisabled] = useState(false);
    const [text, setText] = useState("");
    const [audioClip, setAudioClip] = useState();
    const [image, setImage] = useState();
    const [imageDialogOpen, setImageDialogOpen] = useState(false);
    const [source, setSource] = useState();
    const [settingsProvider, setSettingsProvider] = useState({customAnkiFields: {}});
    const [alertSeverity, setAlertSeverity] = useState();
    const [alertOpen, setAlertOpen] = useState(false);
    const [alert, setAlert] = useState();
    const [themeType, setThemeType] = useState('dark');
    const theme = useMemo(() => createTheme(themeType), [themeType]);
    const anki = useMemo(() => new Anki(settingsProvider, bridge), [settingsProvider, bridge]);

    useEffect(() => {
        return bridge.onStateUpdated((state) => {
            let audioClip;

            if (state.audio) {
                audioClip = AudioClip.fromBase64(
                    state.source,
                    Math.max(0, state.subtitle.start - state.audio.paddingStart),
                    state.subtitle.end + state.audio.paddingEnd,
                    state.audio.base64,
                    state.audio.extension
                );
            }

            let image;

            if (state.image) {
                image = Image.fromBase64(
                    state.source,
                    state.subtitle.start,
                    state.image.base64,
                    state.image.extension
                );
            }

            setImageDialogOpen(false);
            setDisabled(false);
            setSettingsProvider(state.settingsProvider);
            setText(state.subtitle.text);
            setAudioClip(audioClip);
            setImage(image);
            setSource(state.source);
            setThemeType(state.themeType || 'dark');
            setOpen(state.open);
        });
    }, [bridge, mp3WorkerUrl]);

    const handleProceed = useCallback(async (text, definition, audioClip, image, word, source, customFieldValues, mode) => {
        setDisabled(true);

        try {
            const result = await anki.export(
                text,
                definition,
                audioClip,
                image,
                word,
                source,
                customFieldValues,
                mode
            );

            setOpen(false);
            setImageDialogOpen(false);
            bridge.finished({resume: mode !== 'gui'});
        } catch (e) {
            console.error(e);
            setAlertSeverity("error");
            setAlert(e.message);
            setAlertOpen(true);
        } finally {
            setDisabled(false);
        }
    }, [anki, bridge]);

    const handleCancel = useCallback(() => {
        setOpen(false);
        setImageDialogOpen(false);
        bridge.finished({resume: true});
    }, [bridge]);

    const handleViewImage = useCallback((image) => {
        setImage(image);
        setImageDialogOpen(true);
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Snackbar
                anchorOrigin={{horizontal: 'center', vertical: 'top'}}
                open={alertOpen}
                autoHideDuration={5000}
                onClose={() => setAlertOpen(false)}
            >
                <Alert onClose={() => setAlertOpen(false)} severity={alertSeverity}>
                    {alert}
                </Alert>
            </Snackbar>
            <ImageDialog
                open={imageDialogOpen}
                image={image}
                onClose={() => setImageDialogOpen(false)}
            />
            <AnkiDialog
                open={open}
                disabled={disabled}
                text={text}
                audioClip={audioClip}
                image={image}
                source={source}
                settingsProvider={settingsProvider}
                mp3WorkerUrl={mp3WorkerUrl}
                anki={anki}
                onProceed={handleProceed}
                onCancel={handleCancel}
                onViewImage={handleViewImage}
            />
        </ThemeProvider>
    );
}