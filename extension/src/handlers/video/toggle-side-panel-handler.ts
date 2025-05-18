import { CloseSidePanelMessage, Command, ExtensionToAsbPlayerCommand, Message } from '@project/common';
import TabRegistry from '../../services/tab-registry';

export default class ToggleSidePanelHandler {
    private readonly _tabRegistry: TabRegistry;
    constructor(tabRegistry: TabRegistry) {
        this._tabRegistry = tabRegistry;
    }

    get sender() {
        return ['asbplayer-video-tab', 'asbplayerv2'];
    }

    get command() {
        return 'toggle-side-panel';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        let sidePanelOpen = false;
        this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => {
                if (asbplayer.sidePanel) {
                    const command: ExtensionToAsbPlayerCommand<CloseSidePanelMessage> = {
                        sender: 'asbplayer-extension-to-player',
                        message: {
                            command: 'close-side-panel',
                        },
                    };

                    sidePanelOpen = true;
                    return command;
                }

                return undefined;
            },
        });

        if (!sidePanelOpen) {
            browser.windows
                // @ts-ignore
                .getLastFocused((window) => browser.sidePanel.open({ windowId: window.id }));
        }

        return false;
    }
}
