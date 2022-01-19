import { renderPopupUi } from './ui/popup';
import Settings from './services/Settings';

const fetchShortcuts = () => {
    return new Promise((resolve, reject) => {
        chrome.commands.getAll((commands) => {
            const commandsObj = {};

            for (const c of commands) {
                commandsObj[c.name] = c.shortcut;
            }

            resolve(commandsObj);
        });
    });
};

document.addEventListener('DOMContentLoaded', async (e) => {
    const settings = new Settings();
    const currentSettingsPromise = settings.get();
    const commandsPromise = fetchShortcuts();
    const currentSettings = await currentSettingsPromise;
    const commands = await commandsPromise;
    const rootElement = document.getElementById('root');
    const bridge = renderPopupUi(rootElement, { currentSettings, commands });
    bridge.onFinished((message) => {
        switch (message.command) {
            case 'settings-changed':
                const newSetting = {};
                newSetting[message.key] = message.value;
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
