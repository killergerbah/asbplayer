import React, { useCallback } from 'react';
import { makeStyles } from '@material-ui/styles';
import { useTranslation } from 'react-i18next';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import ChromeExtension from '../services/chrome-extension';
import SettingsForm from '../../../components/SettingsForm';
import { useLocalFontFamilies } from '../../../hooks';
import { Anki } from '../../../anki';
import { AsbplayerSettings } from '../../..';

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

interface Props {
    anki: Anki;
    extension: ChromeExtension;
    open: boolean;
    settings: AsbplayerSettings;
    scrollToId?: string;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    onClose: () => void;
}

export default function SettingsDialog({
    anki,
    extension,
    open,
    settings,
    scrollToId,
    onSettingsChanged,
    onClose,
}: Props) {
    const { t } = useTranslation();
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

    return (
        <Dialog open={open} maxWidth="sm" fullWidth className={classes.root} onClose={onClose}>
            <DialogTitle>{t('settings.title')}</DialogTitle>
            <DialogContent className={classes.content}>
                <SettingsForm
                    anki={anki}
                    extensionInstalled={extension.installed}
                    extensionSupportsAppIntegration={extension.supportsAppIntegration}
                    insideApp
                    chromeKeyBinds={extension.extensionCommands}
                    onOpenChromeExtensionShortcuts={extension.openShortcuts}
                    onSettingsChanged={onSettingsChanged}
                    settings={settings}
                    scrollToId={scrollToId}
                    localFontsAvailable={localFontsAvailable}
                    localFontsPermission={localFontsPermission}
                    localFontFamilies={localFontFamilies}
                    onUnlockLocalFonts={handleUnlockLocalFonts}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('action.ok')}</Button>
            </DialogActions>
        </Dialog>
    );
}
