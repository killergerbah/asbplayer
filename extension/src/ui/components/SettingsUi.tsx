import { HttpFetcher } from '@project/common';
import { createTheme } from '@project/common/theme';
import React, { useCallback, useMemo } from 'react';
import { useSettings } from '../hooks/use-settings';
import { ThemeProvider, makeStyles, useTheme } from '@material-ui/core/styles';
import { useTranslation } from 'react-i18next';
import Box from '@material-ui/core/Box';
import SettingsForm from '@project/common/components/SettingsForm';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import { useCommandKeyBinds } from '../hooks/use-command-key-binds';
import { useLocalFontFamilies } from '@project/common/hooks';
import { useI18n } from '../hooks/use-i18n';
import CssBaseline from '@material-ui/core/CssBaseline';
import Paper from '@material-ui/core/Paper';
import { Anki } from '@project/common/anki';
import { useSupportedLanguages } from '../hooks/use-supported-languages';
import { isFirefoxBuild } from '../../services/build-flags';
import SettingsProfileSelectMenu from '@project/common/components/SettingsProfileSelectMenu';

const useStyles = makeStyles((theme) => ({
    root: {
        '& .MuiPaper-root': {
            height: '100vh',
        },
    },
    content: {
        maxHeight: '100%',
    },
    profilesContainer: {
        paddingLeft: theme.spacing(4),
        paddingRight: theme.spacing(4),
    },
}));

const SettingsUi = () => {
    const { t } = useTranslation();

    const { settings, onSettingsChanged, profileContext } = useSettings();
    const anki = useMemo(
        () => (settings === undefined ? undefined : new Anki(settings, new HttpFetcher())),
        [settings]
    );
    const classes = useStyles();

    const {
        updateLocalFontsPermission,
        updateLocalFonts,
        localFontsAvailable,
        localFontsPermission,
        localFontFamilies,
    } = useLocalFontFamilies();
    const handleUnlockLocalFonts = useCallback(() => {
        updateLocalFontsPermission();
        updateLocalFonts();
    }, [updateLocalFontsPermission, updateLocalFonts]);

    const commands = useCommandKeyBinds();

    const handleOpenExtensionShortcuts = useCallback(() => {
        chrome.tabs.create({ active: true, url: 'chrome://extensions/shortcuts' });
    }, []);

    const { initialized: i18nInitialized } = useI18n({ language: settings?.language ?? 'en' });
    const theme = useMemo(() => settings && createTheme(settings.themeType), [settings]);
    const section = useMemo(() => {
        if (location.hash && location.hash.startsWith('#')) {
            return location.hash.substring(1, location.hash.length);
        }

        return undefined;
    }, []);
    const { supportedLanguages } = useSupportedLanguages();

    if (!settings || !anki || !commands || !i18nInitialized || !theme) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Paper square style={{ height: '100vh' }}>
                <Dialog open={true} maxWidth="md" fullWidth className={classes.root} onClose={() => {}}>
                    <DialogTitle>{t('settings.title')}</DialogTitle>
                    <DialogContent className={classes.content}>
                        <SettingsForm
                            anki={anki}
                            extensionInstalled
                            extensionSupportsAppIntegration
                            extensionSupportsOverlay
                            extensionSupportsSidePanel={!isFirefoxBuild}
                            extensionSupportsOrderableAnkiFields
                            extensionSupportsTrackSpecificSettings
                            chromeKeyBinds={commands}
                            onOpenChromeExtensionShortcuts={handleOpenExtensionShortcuts}
                            onSettingsChanged={onSettingsChanged}
                            settings={settings}
                            localFontsAvailable={localFontsAvailable}
                            localFontsPermission={localFontsPermission}
                            localFontFamilies={localFontFamilies}
                            supportedLanguages={supportedLanguages}
                            onUnlockLocalFonts={handleUnlockLocalFonts}
                            scrollToId={section}
                        />
                    </DialogContent>
                    <Box style={{ marginBottom: theme.spacing(2) }} className={classes.profilesContainer}>
                        <SettingsProfileSelectMenu {...profileContext} />
                    </Box>
                </Dialog>
            </Paper>
        </ThemeProvider>
    );
};

export default SettingsUi;
