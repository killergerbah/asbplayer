import React, { useCallback } from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { useTranslation } from 'react-i18next';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import ChromeExtension from '../services/chrome-extension';
import SettingsForm from '../../components/SettingsForm';
import { useLocalFontFamilies } from '../../hooks';
import { Anki } from '../../anki';
import { AsbplayerSettings, Profile, supportedLanguages } from '../../settings';
import SettingsProfileSelectMenu from '../../components/SettingsProfileSelectMenu';

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

interface Props {
    anki: Anki;
    extension: ChromeExtension;
    open: boolean;
    settings: AsbplayerSettings;
    scrollToId?: string;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    onClose: () => void;
    profiles: Profile[];
    activeProfile?: string;
    onNewProfile: (name: string) => void;
    onRemoveProfile: (name: string) => void;
    onSetActiveProfile: (name: string | undefined) => void;
}

export default function SettingsDialog({
    anki,
    extension,
    open,
    settings,
    scrollToId,
    onSettingsChanged,
    onClose,
    ...profilesContext
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
        <Dialog open={open} maxWidth="md" fullWidth className={classes.root} onClose={onClose}>
            <DialogTitle>{t('settings.title')}</DialogTitle>
            <DialogContent className={classes.content}>
                <SettingsForm
                    anki={anki}
                    extensionInstalled={extension.installed}
                    extensionSupportsAppIntegration={extension.supportsAppIntegration}
                    extensionSupportsOverlay={extension.supportsStreamingVideoOverlay}
                    extensionSupportsSidePanel={extension.supportsSidePanel}
                    extensionSupportsOrderableAnkiFields={extension.supportsOrderableAnkiFields}
                    insideApp
                    chromeKeyBinds={extension.extensionCommands}
                    onOpenChromeExtensionShortcuts={extension.openShortcuts}
                    onSettingsChanged={onSettingsChanged}
                    settings={settings}
                    scrollToId={scrollToId}
                    localFontsAvailable={localFontsAvailable}
                    localFontsPermission={localFontsPermission}
                    localFontFamilies={localFontFamilies}
                    supportedLanguages={supportedLanguages}
                    onUnlockLocalFonts={handleUnlockLocalFonts}
                />
            </DialogContent>
            {(!extension.installed || extension.supportsSettingsProfiles) && (
                <Box className={classes.profilesContainer}>
                    <SettingsProfileSelectMenu {...profilesContext} />
                </Box>
            )}
            <DialogActions>
                <Button onClick={onClose}>{t('action.ok')}</Button>
            </DialogActions>
        </Dialog>
    );
}
