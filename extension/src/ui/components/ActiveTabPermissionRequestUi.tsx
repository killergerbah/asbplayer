import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Bridge from '../bridge';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@material-ui/core/Button';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import CssBaseline from '@material-ui/core/CssBaseline';
import { PaletteType } from '@material-ui/core';
import { Message, UpdateStateMessage, createTheme } from '@project/common';

interface Props {
    bridge: Bridge;
}

const ActiveTabPermissionRequestUi = ({ bridge }: Props) => {
    const { t } = useTranslation();
    const handleClose = useCallback(() => {
        bridge.sendMessageFromServer({
            command: 'close',
        });
        setPermissionGranted(false);
    }, [bridge]);
    useEffect(() => {
        bridge.addClientMessageListener((message: Message) => {
            if (message.command !== 'updateState') {
                return;
            }

            const state = (message as UpdateStateMessage).state;

            if (state.themeType !== undefined) {
                setThemeType(state.themeType);
            }

            if (state.permissionGranted !== undefined) {
                setPermissionGranted(state.permissionGranted);
            }
        });
    }, [bridge]);
    const [themeType, setThemeType] = useState<PaletteType>('dark');
    const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
    const theme = useMemo(() => createTheme(themeType), [themeType]);
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Dialog open={true} disableEnforceFocus fullWidth maxWidth="sm" onClose={handleClose}>
                <DialogTitle>
                    {permissionGranted
                        ? t('activeTabPermissionRequest.grantedTitle')
                        : t('activeTabPermissionRequest.title')}
                </DialogTitle>
                <DialogContent>
                    {permissionGranted
                        ? t('activeTabPermissionRequest.grantedPrompt')
                        : t('activeTabPermissionRequest.prompt')}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>{t('action.ok')}</Button>
                </DialogActions>
            </Dialog>
        </ThemeProvider>
    );
};

export default ActiveTabPermissionRequestUi;
