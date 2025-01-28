import { Fetcher } from '@project/common';
import { useChromeExtension } from '@project/common/app';
import RootApp from '@project/common/app/components/RootApp';
import { useMemo } from 'react';
import { AppExtensionSettingsStorage } from '@project/common/app/services/app-extension-settings-storage';
import { AppExtensionGlobalStateProvider } from '@project/common/app/services/app-extension-global-state-provider';
import { LocalSettingsStorage } from '../local-settings-storage';

interface Props {
    origin: string;
    logoUrl: string;
    fetcher: Fetcher;
}

const WebsiteApp = (props: Props) => {
    const extension = useChromeExtension({ component: 'application' });
    const settingsStorage = useMemo(() => {
        if (extension.supportsAppIntegration) {
            return new AppExtensionSettingsStorage(extension);
        }

        return new LocalSettingsStorage();
    }, [extension]);
    const globalStateProvider = useMemo(() => new AppExtensionGlobalStateProvider(extension), [extension]);
    return (
        <RootApp
            {...props}
            extension={extension}
            settingsStorage={settingsStorage}
            globalStateProvider={globalStateProvider}
        />
    );
};

export default WebsiteApp;
