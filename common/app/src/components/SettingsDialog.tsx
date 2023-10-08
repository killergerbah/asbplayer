import React from 'react';
import { makeStyles } from '@material-ui/styles';
import { useTranslation } from 'react-i18next';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import { Anki, AsbplayerSettings } from '@project/common';
import ChromeExtension from '../services/chrome-extension';
import { SettingsForm } from '../../../components';

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
    onSettingsChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => void;
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

    return (
        <Dialog open={open} maxWidth="sm" fullWidth className={classes.root} onClose={onClose}>
            <DialogTitle>{t('settings.title')}</DialogTitle>
            <DialogContent className={classes.content}>
                <SettingsForm
                    anki={anki}
                    insideExtension={extension.installed}
                    chromeKeyBinds={extension.extensionCommands}
                    onOpenChromeExtensionShortcuts={extension.openShortcuts}
                    open={open}
                    onSettingsChanged={onSettingsChanged}
                    onClose={onClose}
                    settings={settings}
                    scrollToId={scrollToId}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('action.ok')}</Button>
            </DialogActions>
        </Dialog>
    );
}
