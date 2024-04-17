import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Bridge from '../bridge';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '@material-ui/core/Button';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import CssBaseline from '@material-ui/core/CssBaseline';
import { PaletteType } from '@material-ui/core';
import { Message, UpdateStateMessage } from '@project/common';
import { createTheme } from '@project/common/theme';
import Snackbar from '@material-ui/core/Snackbar';
import Alert from '@material-ui/lab/Alert';
import LogoIcon from '@project/common/components/LogoIcon';
import Link from '@material-ui/core/Link';

interface Props {
    bridge: Bridge;
}

const NotificationUi = ({ bridge }: Props) => {
    const { t } = useTranslation();
    const handleClose = useCallback(() => {
        setShowAlert(false);
        setNewVersion(undefined);
        bridge.sendMessageFromServer({
            command: 'close',
        });
    }, [bridge]);
    const [title, setTitle] = useState<string>();
    const [message, setMessage] = useState<string>();
    const [newVersion, setNewVersion] = useState<string>();
    const [showAlert, setShowAlert] = useState<boolean>(false);

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
                setTitle(state.titleLocKey === '' ? '' : t(state.titleLocKey) ?? '');
            }

            if (state.messageLocKey !== undefined) {
                setMessage(state.messageLocKey === '' ? '' : t(state.messageLocKey) ?? '');
            }

            if (state.newVersion !== undefined) {
                setNewVersion(state.newVersion);
                setShowAlert(true);
            }
        });
    }, [bridge, t]);
    const [themeType, setThemeType] = useState<PaletteType>('dark');
    const theme = useMemo(() => createTheme(themeType), [themeType]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {message && title && (
                <Dialog open={true} disableEnforceFocus fullWidth maxWidth="sm" onClose={handleClose}>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogContent>{message}</DialogContent>
                    <DialogActions>
                        <Button onClick={handleClose}>{t('action.ok')}</Button>
                    </DialogActions>
                </Dialog>
            )}
            {newVersion && (
                <Snackbar open={showAlert} onClose={handleClose}>
                    <Alert icon={<LogoIcon />} severity="info" onClose={handleClose}>
                        <Trans
                            i18nKey="update.alert"
                            values={{ version: newVersion }}
                            components={[
                                <Link
                                    key={0}
                                    color="secondary"
                                    target="_blank"
                                    rel="noreferrer"
                                    href={`https://github.com/killergerbah/asbplayer/releases/tag/v${newVersion}`}
                                >
                                    release notes
                                </Link>,
                            ]}
                        />
                    </Alert>
                </Snackbar>
            )}
        </ThemeProvider>
    );
};

export default NotificationUi;
