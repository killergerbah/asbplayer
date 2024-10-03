import { Fetcher } from '@project/common';
import { useChromeExtension } from '@project/common/app';
import RootApp from '@project/common/app/components/RootApp';
import { useMemo } from 'react';
import { AppExtensionSettingsStorage } from '../app-extension-settings-storage';
import { LocalSettingsStorage } from '../local-settings-storage';

interface Props {
    origin: string;
    logoUrl: string;
    fetcher: Fetcher;
}

const WebsiteApp = (props: Props) => {
    const extension = useChromeExtension({ sidePanel: false });
    const settingsStorage = useMemo(() => {
        if (extension.supportsAppIntegration) {
            return new AppExtensionSettingsStorage(extension);
        }

        return new LocalSettingsStorage();
    }, [extension]);
    return <RootApp {...props} extension={extension} settingsStorage={settingsStorage} />;
};

export default WebsiteApp;
