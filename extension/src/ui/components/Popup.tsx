import Grid from '@material-ui/core/Grid';
import {
    AsbplayerSettings,
    HttpPostMessage,
    PopupToExtensionCommand,
    chromeCommandBindsToKeyBinds,
} from '@project/common';
import { PanelIcon, SettingsForm } from '@project/common/components';
import LaunchIcon from '@material-ui/icons/Launch';
import { useCallback, useMemo } from 'react';
import { useI18n } from '@project/common/app';
import Button from '@material-ui/core/Button';
import { useTranslation } from 'react-i18next';
import { Fetcher } from '@project/common/src/fetcher';
import { useLocalFontFamilies } from '@project/common/hooks';
import { Anki } from '@project/common/anki';

interface Props {
    settings: AsbplayerSettings;
    commands: any;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    onOpenApp: () => void;
    onOpenSidePanel: () => void;
    onOpenExtensionShortcuts: () => void;
}

class ExtensionFetcher implements Fetcher {
    fetch(url: string, body: any) {
        const httpPostCommand: PopupToExtensionCommand<HttpPostMessage> = {
            sender: 'asbplayer-popup',
            message: {
                command: 'http-post',
                url,
                body,
                messageId: '',
            },
        };
        return chrome.runtime.sendMessage(httpPostCommand);
    }
}

const Popup = ({
    settings,
    commands,
    onOpenApp,
    onOpenSidePanel,
    onSettingsChanged,
    onOpenExtensionShortcuts,
}: Props) => {
    const { t } = useTranslation();
    const { initialized: i18nInitialized } = useI18n({ language: settings.language });
    const anki = useMemo(() => new Anki(settings, new ExtensionFetcher()), [settings]);
    const handleUnlockLocalFonts = useCallback(() => {
        chrome.tabs.create({
            url: `${chrome.runtime.getURL('settings-ui.html')}#subtitle-appearance`,
            active: true,
        });
    }, []);
    const { localFontsAvailable, localFontsPermission, localFontFamilies } = useLocalFontFamilies();

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
                    extensionInstalled
                    extensionSupportsAppIntegration
                    anki={anki}
                    chromeKeyBinds={chromeCommandBindsToKeyBinds(commands)}
                    settings={settings}
                    localFontsAvailable={localFontsAvailable}
                    localFontsPermission={localFontsPermission}
                    localFontFamilies={localFontFamilies}
                    onSettingsChanged={onSettingsChanged}
                    onOpenChromeExtensionShortcuts={onOpenExtensionShortcuts}
                    onUnlockLocalFonts={handleUnlockLocalFonts}
                />
            </Grid>
        </Grid>
    );
};

export default Popup;
