import {
    AsbPlayerToVideoCommand,
    Command,
    CopySubtitleMessage,
    ExtensionToVideoCommand,
    Message,
    MineSubtitleMessage,
} from '@project/common';
import TabRegistry from '../../services/tab-registry';

export default class MineSubtitleHandler {
    private readonly _tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this._tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'mine-subtitle';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const mineSubtitleCommand = command as AsbPlayerToVideoCommand<MineSubtitleMessage>;
        this._tabRegistry.publishCommandToVideoElements(
            (videoElement): ExtensionToVideoCommand<Message> | undefined => {
                if (videoElement.src !== mineSubtitleCommand.src || videoElement.tab.id !== mineSubtitleCommand.tabId) {
                    return undefined;
                }

                const copySubtitleCommand: ExtensionToVideoCommand<CopySubtitleMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'copy-subtitle',
                        postMineAction: mineSubtitleCommand.message.postMineAction,
                    },
                    src: videoElement.src,
                };
                return copySubtitleCommand;
            }
        );
        return false;
    }
}
