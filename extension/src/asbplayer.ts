import {
    AddProfileMessage,
    GetSettingsMessage,
    RemoveProfileMessage,
    RequestSubtitlesResponse,
    SetActiveProfileMessage,
    SetSettingsMessage,
} from '@project/common';
import { ExtensionSettingsStorage } from './services/extension-settings-storage';

const sendMessageToPlayer = (message: any) => {
    window.postMessage({
        sender: 'asbplayer-extension-to-player',
        message,
    });
};

const settingsStorage = new ExtensionSettingsStorage();

window.addEventListener('message', async (event) => {
    if (event.source !== window) {
        return;
    }

    const command = event.data;

    if (command.sender === 'asbplayer' || command.sender === 'asbplayerv2') {
        switch (command.message.command) {
            case 'get-settings':
                const getSettingsMessage = command.message as GetSettingsMessage;
                sendMessageToPlayer({
                    response: await settingsStorage.get(getSettingsMessage.keysAndDefaults),
                    messageId: command.message.messageId,
                });
                break;
            case 'set-settings':
                const setSettingsMessage = command.message as SetSettingsMessage;
                await settingsStorage.set(setSettingsMessage.settings);
                sendMessageToPlayer({
                    messageId: command.message.messageId,
                });
                break;
            case 'get-active-profile':
                sendMessageToPlayer({
                    response: await settingsStorage.activeProfile(),
                    messageId: command.message.messageId,
                });
                break;
            case 'set-active-profile':
                const setActiveProfileMessage = command.message as SetActiveProfileMessage;
                await settingsStorage.setActiveProfile(setActiveProfileMessage.name);
                sendMessageToPlayer({
                    messageId: command.message.messageId,
                });
                break;
            case 'get-profiles':
                sendMessageToPlayer({
                    response: await settingsStorage.profiles(),
                    messageId: command.message.messageId,
                });
                break;
            case 'add-profile':
                const addProfileMessage = command.message as AddProfileMessage;
                await settingsStorage.addProfile(addProfileMessage.name);
                sendMessageToPlayer({
                    messageId: command.message.messageId,
                });
                break;
            case 'remove-profile':
                const removeProfileMessage = command.message as RemoveProfileMessage;
                await settingsStorage.removeProfile(removeProfileMessage.name);
                sendMessageToPlayer({
                    messageId: command.message.messageId,
                });
                break;
            case 'request-subtitles':
                const response = (await chrome.runtime.sendMessage(command)) as RequestSubtitlesResponse | undefined;
                sendMessageToPlayer({
                    response,
                    messageId: command.message.messageId,
                });
                break;
            default:
                chrome.runtime.sendMessage(command);
                break;
        }
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.sender === 'asbplayer-extension-to-player') {
        window.postMessage(request);
    }
});

const manifest = chrome.runtime.getManifest();

window.addEventListener('DOMContentLoaded', async (e) => {
    const extensionCommands = await chrome.runtime.sendMessage({
        sender: 'asbplayerv2',
        message: {
            command: 'extension-commands',
        },
    });

    sendMessageToPlayer({
        command: 'version',
        version: manifest.version,
        extensionCommands,
    });
});
