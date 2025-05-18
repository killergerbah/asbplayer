import type {
    AddProfileMessage,
    GetGlobalStateMessage,
    GetSettingsMessage,
    RemoveProfileMessage,
    RequestCopyHistoryMessage,
    RequestCopyHistoryResponse,
    RequestSubtitlesResponse,
    SetActiveProfileMessage,
    SetGlobalStateMessage,
    SetSettingsMessage,
} from '@project/common';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import { ExtensionGlobalStateProvider } from '@/services/extension-global-state-provider';
import type { ContentScriptContext } from '#imports';

const matches = ['*://killergerbah.github.io/asbplayer*'];

if (import.meta.env.DEV) {
    matches.push('*://localhost/*');
}

export default defineContentScript({
    // Set manifest options
    matches,
    allFrames: true,
    runAt: 'document_start',

    main(ctx: ContentScriptContext) {
        const sendMessageToPlayer = (message: any) => {
            window.postMessage({
                sender: 'asbplayer-extension-to-player',
                message,
            });
        };

        const settingsStorage = new ExtensionSettingsStorage();
        const globalStateProvider = new ExtensionGlobalStateProvider();

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
                        sendMessageToPlayer({
                            response: (await browser.runtime.sendMessage(command)) as
                                | RequestSubtitlesResponse
                                | undefined,
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'request-copy-history':
                        const requestCopyHistoryRequest = command.message as RequestCopyHistoryMessage;
                        sendMessageToPlayer({
                            response: (await browser.runtime.sendMessage(command)) as
                                | RequestCopyHistoryResponse
                                | undefined,
                            messageId: requestCopyHistoryRequest.messageId,
                            count: requestCopyHistoryRequest.count,
                        });
                        break;
                    case 'save-copy-history':
                        await browser.runtime.sendMessage(command);
                        sendMessageToPlayer({
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'delete-copy-history':
                        await browser.runtime.sendMessage(command);
                        sendMessageToPlayer({
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'clear-copy-history':
                        await browser.runtime.sendMessage(command);
                        sendMessageToPlayer({
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'get-global-state':
                        const getGlobalStateMessage = command.message as GetGlobalStateMessage;
                        const { keys } = getGlobalStateMessage;
                        sendMessageToPlayer({
                            response:
                                keys === undefined
                                    ? await globalStateProvider.getAll()
                                    : await globalStateProvider.get(keys),
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'set-global-state':
                        const setGlobalStateMessage = command.message as SetGlobalStateMessage;
                        await globalStateProvider.set(setGlobalStateMessage.state);
                        sendMessageToPlayer({
                            messageId: command.message.messageId,
                        });
                        break;
                    default:
                        browser.runtime.sendMessage(command);
                        break;
                }
            }
        });

        browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.sender === 'asbplayer-extension-to-player') {
                window.postMessage(request);
            }
        });

        const manifest = browser.runtime.getManifest();

        window.addEventListener('DOMContentLoaded', async (e) => {
            const extensionCommands = await browser.runtime.sendMessage({
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
    },
});
