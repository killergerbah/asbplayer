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
    const bridge = await renderPopupUi(rootElement, { currentSettings, commands });
    bridge.onServerMessage(async (message: any) => {
        switch (message.command) {
            case 'settings-changed':
                const key = message.key as keyof AsbplayerSettings;
                const settingsChangedMessage = message as SettingsChangedMessage<typeof key>;
                const newSetting: any = {};
                newSetting[settingsChangedMessage.key] = settingsChangedMessage.value;
                await settings.set(newSetting);
                const settingsUpdatedCommand: PopupToExtensionCommand<SettingsUpdatedMessage> = {
                    sender: 'asbplayer-popup',
                    message: {
                        command: 'settings-updated',
                    },
                };
                chrome.runtime.sendMessage(settingsUpdatedCommand);
                break;
            case 'open-extension-shortcuts':
                chrome.tabs.create({ active: true, url: 'chrome://extensions/shortcuts' });
                break;
            case 'open-app':
                chrome.tabs.create({ active: true, url: `chrome-extension://${chrome.runtime.id}/app-ui.html` });
                break;
            case 'open-side-panel':
                // @ts-ignore
                chrome.sidePanel.open({ windowId: (await chrome.windows.getLastFocused()).id });
                break;
            default:
                console.error('Unknown command ' + message.command);
        }
    });
    bridge.onFetch(async (url: string, body: any) => {
        const httpPostCommand: PopupToExtensionCommand<HttpPostMessage> = {
            sender: 'asbplayer-popup',
            message: {
                command: 'http-post',
                url,
                body,
            },
        };
        return await chrome.runtime.sendMessage(httpPostCommand);
    });
});
