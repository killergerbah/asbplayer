import Grid from '@material-ui/core/Grid';
import { Anki, AsbplayerSettings, chromeCommandBindsToKeyBinds } from '@project/common';
import { PanelIcon, SettingsForm } from '@project/common/components';
import LaunchIcon from '@material-ui/icons/Launch';
import { useMemo } from 'react';
import Bridge from '../bridge';
import { useI18n } from '@project/common/app';
import { Button } from '@material-ui/core';
import { useTranslation } from 'react-i18next';

interface Props {
    settings: AsbplayerSettings;
    commands: any;
    bridge: Bridge;
    onSettingsChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => void;
    onOpenApp: () => void;
    onOpenSidePanel: () => void;
    onOpenExtensionShortcuts: () => void;
}

const Popup = ({
    settings,
    bridge,
    commands,
    onOpenApp,
    onOpenSidePanel,
    onSettingsChanged,
    onOpenExtensionShortcuts,
}: Props) => {
    const { t } = useTranslation();
    const { initialized: i18nInitialized } = useI18n({ language: settings.language });
    const anki = useMemo(() => new Anki(settings, bridge), [settings, bridge]);

    if (!i18nInitialized) {
        return null;
    }

    return (
        <Grid container direction="column" spacing={1} style={{ width: 500 }}>
            <Grid item>
                <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<LaunchIcon />}
                    onClick={onOpenApp}
                    style={{ width: '100%' }}
                >
                    {t('action.openApp')}
                </Button>
            </Grid>
            <Grid item>
                <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<PanelIcon />}
                    onClick={onOpenSidePanel}
                    style={{ width: '100%' }}
                >
                    {t('action.openSidePanel')}
                </Button>
            </Grid>
            <Grid item style={{ height: 450 }}>
                <SettingsForm
                    open
                    insideExtension
                    anki={anki}
                    chromeKeyBinds={chromeCommandBindsToKeyBinds(commands)}
                    settings={settings}
                    onSettingsChanged={onSettingsChanged}
                    onOpenChromeExtensionShortcuts={onOpenExtensionShortcuts}
                />
            </Grid>
        </Grid>
    );
};

export default Popup;
