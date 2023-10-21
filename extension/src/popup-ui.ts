import { ExtensionSettingsStorage } from './services/extension-settings-storage';
import { renderPopupUi, SettingsChangedMessage } from './ui/popup';
import {
    AsbplayerSettings,
    HttpPostMessage,
    PopupToExtensionCommand,
    SettingsProvider,
    SettingsUpdatedMessage,
} from '@project/common';

const fetchShortcuts = () => {
    return new Promise((resolve, reject) => {
        chrome.commands.getAll((commands) => {
            const commandsObj: any = {};

            for (const c of commands) {
                if (c.name && c.shortcut) {
                    commandsObj[c.name] = c.shortcut;
                }
            }

            resolve(commandsObj);
        });
    });
};

document.addEventListener('DOMContentLoaded', async (e) => {
    const settings = new SettingsProvider(new ExtensionSettingsStorage());
    const currentSettingsPromise = settings.getAll();
    const commandsPromise = fetchShortcuts();
    const currentSettings = await currentSettingsPromise;
    const commands = await commandsPromise;
    const rootElement = document.getElementById('root')!;
    await renderPopupUi(rootElement, { currentSettings, commands });
});
