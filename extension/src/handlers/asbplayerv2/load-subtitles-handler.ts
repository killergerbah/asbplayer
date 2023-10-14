import {
    AsbPlayerToTabCommand,
    Command,
    ExtensionToVideoCommand,
    LoadSubtitlesMessage,
    Message,
    ToggleVideoSelectMessage,
} from '@project/common';
import TabRegistry from '../../services/tab-registry';

export default class LoadSubtitlesHandler {
    private readonly _tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this._tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'load-subtitles';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const loadSubtitlesCommand = command as AsbPlayerToTabCommand<LoadSubtitlesMessage>;
        const toggleVideoSelectCommand: ExtensionToVideoCommand<ToggleVideoSelectMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'toggle-video-select',
            },
        };
        this._tabRegistry.publishCommandToVideoElementTabs((tab) =>
            tab.id === loadSubtitlesCommand.tabId ? toggleVideoSelectCommand : undefined
        );
        return false;
    }
}
