import Grid from '@mui/material/Grid';
import { HttpPostMessage, PopupToExtensionCommand } from '@project/common';
import { AsbplayerSettings, Profile, chromeCommandBindsToKeyBinds } from '@project/common/settings';
import SettingsForm from '@project/common/components/SettingsForm';
import PanelIcon from '@project/common/components/PanelIcon';
import LaunchIcon from '@mui/icons-material/Launch';
import { useCallback, useMemo } from 'react';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';
import { Fetcher } from '@project/common/src/fetcher';
import { useLocalFontFamilies } from '@project/common/hooks';
import { Anki } from '@project/common/anki';
import { useSupportedLanguages } from '../hooks/use-supported-languages';
import { useI18n } from '../hooks/use-i18n';
import { isMobile } from 'react-device-detect';
import { isFirefoxBuild } from '../../services/build-flags';
import { useTheme } from '@mui/material/styles';
import SettingsProfileSelectMenu from '@project/common/components/SettingsProfileSelectMenu';

interface Props {
    settings: AsbplayerSettings;
    commands: any;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    onOpenApp: () => void;
    onOpenSidePanel: () => void;
    onOpenExtensionShortcuts: () => void;
    profiles: Profile[];
    activeProfile?: string;
    onNewProfile: (name: string) => void;
    onRemoveProfile: (name: string) => void;
    onSetActiveProfile: (name: string | undefined) => void;
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
        return browser.runtime.sendMessage(httpPostCommand);
    }
}

const Popup = ({
    settings,
    commands,
    onOpenApp,
    onOpenSidePanel,
    onSettingsChanged,
    onOpenExtensionShortcuts,
    ...profilesContext
}: Props) => {
    const { t } = useTranslation();
    const { initialized: i18nInitialized } = useI18n({ language: settings.language });
    const anki = useMemo(() => new Anki(settings, new ExtensionFetcher()), [settings]);
    const handleUnlockLocalFonts = useCallback(() => {
        browser.tabs.create({
            url: `${browser.runtime.getURL('/options.html')}#subtitle-appearance`,
            active: true,
        });
    }, []);
    const { supportedLanguages } = useSupportedLanguages();
    const { localFontsAvailable, localFontsPermission, localFontFamilies } = useLocalFontFamilies();
    const theme = useTheme();

    if (!i18nInitialized) {
        return null;
    }

    return (
        <Grid container direction="column" spacing={0}>
            <Grid
                item
                style={{ marginLeft: theme.spacing(2), marginTop: theme.spacing(2), marginRight: theme.spacing(2) }}
            >
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<LaunchIcon />}
                    onClick={onOpenApp}
                    style={{ width: '100%' }}
                >
                    {t('action.openApp')}
                </Button>
            </Grid>
            {!isMobile && !isFirefoxBuild && (
                <Grid
                    item
                    style={{ marginLeft: theme.spacing(2), marginTop: theme.spacing(1), marginRight: theme.spacing(2) }}
                >
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<PanelIcon />}
                        onClick={onOpenSidePanel}
                        style={{ width: '100%' }}
                    >
                        {t('action.openSidePanel')}
                    </Button>
                </Grid>
            )}
            <Grid
                item
                style={{
                    height: isMobile ? 'auto' : 390,
                    marginLeft: theme.spacing(1),
                    marginTop: theme.spacing(1),
                    marginRight: theme.spacing(1),
                }}
            >
                <SettingsForm
                    extensionInstalled
                    extensionVersion={browser.runtime.getManifest().version}
                    extensionSupportsAppIntegration
                    extensionSupportsOverlay
                    extensionSupportsSidePanel={!isFirefoxBuild}
                    extensionSupportsOrderableAnkiFields
                    extensionSupportsTrackSpecificSettings
                    extensionSupportsSubtitlesWidthSetting
                    extensionSupportsPauseOnHover
                    extensionSupportsExportCardBind
                    forceVerticalTabs={false}
                    anki={anki}
                    chromeKeyBinds={chromeCommandBindsToKeyBinds(commands)}
                    settings={settings}
                    localFontsAvailable={localFontsAvailable}
                    localFontsPermission={localFontsPermission}
                    localFontFamilies={localFontFamilies}
                    supportedLanguages={supportedLanguages}
                    onSettingsChanged={onSettingsChanged}
                    onOpenChromeExtensionShortcuts={onOpenExtensionShortcuts}
                    onUnlockLocalFonts={handleUnlockLocalFonts}
                />
            </Grid>
            <Grid
                item
                style={{
                    marginLeft: theme.spacing(2),
                    marginTop: theme.spacing(1),
                    marginRight: theme.spacing(2),
                    marginBottom: theme.spacing(2),
                }}
            >
                <SettingsProfileSelectMenu {...profilesContext} />
            </Grid>
        </Grid>
    );
};

export default Popup;
