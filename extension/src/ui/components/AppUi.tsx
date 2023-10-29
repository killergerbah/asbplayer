import { BrowserRouter } from 'react-router-dom';
import { ExtensionSettingsStorage } from '../../services/extension-settings-storage';
import { RootApp } from '@project/common/app';

const settingsStorage = new ExtensionSettingsStorage();

export const AppUi = () => {
    return (
        <BrowserRouter>
            <RootApp
                origin={chrome.runtime.getURL('app-ui.html')}
                logoUrl={chrome.runtime.getURL('assets/image.png')}
                settingsStorage={settingsStorage}
            />
        </BrowserRouter>
    );
};
