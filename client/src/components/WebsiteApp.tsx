import { Fetcher } from '@project/common';
import { RootApp, useChromeExtension } from '@project/common/app';
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
        if (extension.installed) {
            return new AppExtensionSettingsStorage(extension);
        }

        return new LocalSettingsStorage();
    }, [extension]);
    return <RootApp {...props} settingsStorage={settingsStorage} />;
};

export default WebsiteApp;
