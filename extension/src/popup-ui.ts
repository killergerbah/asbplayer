import { renderPopupUi, SettingsChangedMessage } from './ui/popup';
import Settings from './services/Settings';
import { ExtensionSettings } from '@project/common';

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
    const settings = new Settings();
    const currentSettingsPromise = settings.getAll();
    const commandsPromise = fetchShortcuts();
    const currentSettings = await currentSettingsPromise;
    const commands = await commandsPromise;
    const rootElement = document.getElementById('root')!;
    const bridge = renderPopupUi(rootElement, { currentSettings, commands });
    bridge.onFinished((message: any) => {
        switch (message.command) {
            case 'settings-changed':
                const key = message.key as keyof ExtensionSettings;
                const settingsChangedMessage = message as SettingsChangedMessage<typeof key>;
                const newSetting: any = {};
                newSetting[settingsChangedMessage.key] = settingsChangedMessage.value;
                settings.set(newSetting);
                chrome.runtime.sendMessage({
                    sender: 'asbplayer-popup',
                    message: {
                        command: 'settings-updated',
                    },
                });
                break;
            case 'open-extension-shortcuts':
                chrome.tabs.create({ active: true, url: 'chrome://extensions/shortcuts' });
                break;
            default:
                console.error('Unknown command ' + message.command);
        }
    });
});
