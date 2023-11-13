import { HttpFetcher, createTheme } from '@project/common';
import { useCallback, useMemo } from 'react';
import { useSettings } from '../hooks/use-settings';
import { ThemeProvider, makeStyles } from '@material-ui/core/styles';
import { useTranslation } from 'react-i18next';
import { SettingsForm } from '@project/common/components';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import { useCommandKeyBinds } from '../hooks/use-command-key-binds';
import { useI18n, useLocalFontFamilies } from '@project/common/hooks';
import CssBaseline from '@material-ui/core/CssBaseline';
import Paper from '@material-ui/core/Paper';
import { Anki } from '@project/common/anki';

const useStyles = makeStyles({
    root: {
        '& .MuiPaper-root': {
            height: '100vh',
        },
    },
    content: {
        maxHeight: '100%',
    },
});

const SettingsUi = () => {
    const { t } = useTranslation();

    const { settings, onSettingsChanged } = useSettings();
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
    const theme = useMemo(() => settings && createTheme(settings.themeType), [settings?.themeType]);
    const section = useMemo(() => {
        if (location.hash && location.hash.startsWith('#')) {
            return location.hash.substring(1, location.hash.length);
        }

        return undefined;
    }, [location.hash]);

    if (!settings || !anki || !commands || !i18nInitialized || !theme) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Paper square style={{ height: '100vh' }}>
                <Dialog open={true} maxWidth="sm" fullWidth className={classes.root} onClose={() => {}}>
                    <DialogTitle>{t('settings.title')}</DialogTitle>
                    <DialogContent className={classes.content}>
                        <SettingsForm
                            anki={anki}
                            extensionInstalled
                            extensionSupportsAppIntegration
                            chromeKeyBinds={commands}
                            onOpenChromeExtensionShortcuts={handleOpenExtensionShortcuts}
                            onSettingsChanged={onSettingsChanged}
                            settings={settings}
                            localFontsAvailable={localFontsAvailable}
                            localFontsPermission={localFontsPermission}
                            localFontFamilies={localFontFamilies}
                            onUnlockLocalFonts={handleUnlockLocalFonts}
                            scrollToId={section}
                        />
                    </DialogContent>
                </Dialog>
            </Paper>
        </ThemeProvider>
    );
};

export default SettingsUi;
