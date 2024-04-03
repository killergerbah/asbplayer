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
import { Message, UpdateStateMessage } from '@project/common';
import { createTheme } from '@project/common/theme';

interface Props {
    bridge: Bridge;
}

const NotificationUi = ({ bridge }: Props) => {
    const { t } = useTranslation();
    const handleClose = useCallback(() => {
        bridge.sendMessageFromServer({
            command: 'close',
        });
    }, [bridge]);
    const [title, setTitle] = useState<string>();
    const [message, setMessage] = useState<string>();

    useEffect(() => {
        bridge.addClientMessageListener((message: Message) => {
            if (message.command !== 'updateState') {
                return;
            }

            const state = (message as UpdateStateMessage).state;

            if (state.themeType !== undefined) {
                setThemeType(state.themeType);
            }

            if (state.titleLocKey !== undefined) {
                setTitle(t(state.titleLocKey) ?? '');
            }

            if (state.messageLocKey !== undefined) {
                setMessage(t(state.messageLocKey) ?? '');
            }
        });
    }, [bridge, t]);
    const [themeType, setThemeType] = useState<PaletteType>('dark');
    const theme = useMemo(() => createTheme(themeType), [themeType]);

    if (!message || !title) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Dialog open={true} disableEnforceFocus fullWidth maxWidth="sm" onClose={handleClose}>
                <DialogTitle>{title}</DialogTitle>
                <DialogContent>{message}</DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>{t('action.ok')}</Button>
                </DialogActions>
            </Dialog>
        </ThemeProvider>
    );
};

export default NotificationUi;
