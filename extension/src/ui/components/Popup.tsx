import Grid from '@mui/material/Grid';
import { HttpPostMessage, PopupToExtensionCommand } from '@project/common';
import { AsbplayerSettings, Profile, chromeCommandBindsToKeyBinds } from '@project/common/settings';
import SettingsForm from '@project/common/components/SettingsForm';
import PanelIcon from '@project/common/components/PanelIcon';
import LaunchIcon from '@mui/icons-material/Launch';
import { useCallback, useMemo } from 'react';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
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
import { settingsPageConfigs } from '@/services/pages';
import Stack from '@mui/material/Stack';
import TutorialIcon from '@project/common/components/TutorialIcon';
import Paper from '@mui/material/Paper';
import { DictionaryProvider } from '@project/common/dictionary-db';
import { useAnnotationTutorial } from '@project/common/hooks/use-annotation-tutorial';
import { ExtensionGlobalStateProvider } from '@/services/extension-global-state-provider';

const globalStateProvider = new ExtensionGlobalStateProvider();

interface Props {
    dictionaryProvider: DictionaryProvider;
    settings: AsbplayerSettings;
    commands: any;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    onOpenApp: () => void;
    onOpenSidePanel: () => void;
    onOpenExtensionShortcuts: () => void;
    onOpenUserGuide: () => void;
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
    dictionaryProvider,
    settings,
    commands,
    onOpenApp,
    onOpenSidePanel,
    onSettingsChanged,
    onOpenExtensionShortcuts,
    onOpenUserGuide,
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
    const { handleAnnotationTutorialSeen, inAnnotationTutorial } = useAnnotationTutorial({ globalStateProvider });

    if (!i18nInitialized) {
        return null;
    }

    return (
        <Paper>
            <Stack direction="column" spacing={1.5} sx={{ padding: theme.spacing(1.5) }}>
                <ButtonGroup fullWidth variant="contained" color="primary" orientation="horizontal">
                    <Button variant="contained" color="primary" startIcon={<LaunchIcon />} onClick={onOpenApp}>
                        {t('action.openApp')}
                    </Button>
                    {!isMobile && !isFirefoxBuild && (
                        <Button variant="contained" color="primary" startIcon={<PanelIcon />} onClick={onOpenSidePanel}>
                            {t('action.openSidePanel')}
                        </Button>
                    )}
                    <Button variant="contained" color="primary" startIcon={<TutorialIcon />} onClick={onOpenUserGuide}>
                        {t('action.userGuide')}
                    </Button>
                </ButtonGroup>
                <Grid
                    item
                    style={{
                        height: isMobile ? 'auto' : 390,
                    }}
                >
                    <SettingsForm
                        heightConstrained
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
                        extensionSupportsPageSettings
                        extensionSupportsDictionary
                        forceVerticalTabs={false}
                        anki={anki}
                        chromeKeyBinds={chromeCommandBindsToKeyBinds(commands)}
                        dictionaryProvider={dictionaryProvider}
                        settings={settings}
                        profiles={profilesContext.profiles}
                        activeProfile={profilesContext.activeProfile}
                        pageConfigs={settingsPageConfigs}
                        localFontsAvailable={localFontsAvailable}
                        localFontsPermission={localFontsPermission}
                        localFontFamilies={localFontFamilies}
                        supportedLanguages={supportedLanguages}
                        onSettingsChanged={onSettingsChanged}
                        onOpenChromeExtensionShortcuts={onOpenExtensionShortcuts}
                        onUnlockLocalFonts={handleUnlockLocalFonts}
                        inAnnotationTutorial={inAnnotationTutorial}
                        onAnnotationTutorialSeen={handleAnnotationTutorialSeen}
                    />
                </Grid>
                <Grid item>
                    <SettingsProfileSelectMenu {...profilesContext} />
                </Grid>
            </Stack>
        </Paper>
    );
};

export default Popup;
