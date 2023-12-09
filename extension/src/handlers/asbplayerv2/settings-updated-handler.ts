import {
    AsbPlayerCommand,
    Command,
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    Message,
    SettingsUpdatedMessage,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { primeLocalization } from '../../services/localization-fetcher';
import TabRegistry from '../../services/tab-registry';

export default class SettingsUpdatedHandler {
    private readonly _tabRegistry: TabRegistry;
    private readonly _settingsProvider: SettingsProvider;

    constructor(tabRegistry: TabRegistry, settingsProvider: SettingsProvider) {
        this._tabRegistry = tabRegistry;
        this._settingsProvider = settingsProvider;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'settings-updated';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const settingsUpdatedCommand = command as AsbPlayerCommand<SettingsUpdatedMessage>;
        this._settingsProvider.getSingle('language').then(primeLocalization);
        this._tabRegistry.publishCommandToVideoElements((videoElement) => {
            const videoElementCommand: ExtensionToVideoCommand<SettingsUpdatedMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'settings-updated',
                },
                src: videoElement.src,
            };
            return videoElementCommand;
        });
        this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => {
                if (
                    settingsUpdatedCommand.asbplayerId !== undefined &&
                    settingsUpdatedCommand.asbplayerId === asbplayer.id
                ) {
                    // Skip the asbplayer instance that published the message originally
                    return;
                }

                const asbplayerCommand: ExtensionToAsbPlayerCommand<SettingsUpdatedMessage> = {
                    sender: 'asbplayer-extension-to-player',
                    message: {
                        command: 'settings-updated',
                    },
                };
                return asbplayerCommand;
            },
        });
        return false;
    }
}
