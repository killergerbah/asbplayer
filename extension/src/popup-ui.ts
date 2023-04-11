import { renderPopupUi, SettingsChangedMessage } from './ui/popup';
import Settings from './services/settings';
import {
    EditKeyboardShortcutsMessage,
    ExtensionSettings,
    PopupToExtensionCommand,
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
    const settings = new Settings();
    const currentSettingsPromise = settings.getAll();
    const commandsPromise = fetchShortcuts();
    const currentSettings = await currentSettingsPromise;
    const commands = await commandsPromise;
    const rootElement = document.getElementById('root')!;
    const bridge = renderPopupUi(rootElement, { currentSettings, commands });
    bridge.onServerMessage(async (message: any) => {
        switch (message.command) {
            case 'settings-changed':
                const key = message.key as keyof ExtensionSettings;
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
            case 'open-update-url':
                chrome.tabs.create({ active: true, url: message.url });
                break;
            case 'edit-video-keyboard-shortcuts':
                const editKeyboardShortcutsMessage: PopupToExtensionCommand<EditKeyboardShortcutsMessage> = {
                    sender: 'asbplayer-popup',
                    message: {
                        command: 'edit-keyboard-shortcuts',
                    },
                };
                chrome.runtime.sendMessage(editKeyboardShortcutsMessage);
                break;
            default:
                console.error('Unknown command ' + message.command);
        }
    });
});
