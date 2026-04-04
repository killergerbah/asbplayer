import {
    CloseSidePanelMessage,
    Command,
    ExtensionToAsbPlayerCommand,
    Message,
    ToggleSidePanelMessage,
} from '@project/common';
import TabRegistry from '../../services/tab-registry';
import { setAppRequestedLocation } from '@/services/side-panel';

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
        const toggleSidePanelMessage = command.message as ToggleSidePanelMessage;

        let sidePanelOpen = false;
        let locationChanged = false;

        this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => {
                if (asbplayer.sidePanel) {
                    sidePanelOpen = true;
                    if (asbplayer.sidePanelAppRequestedLocation === toggleSidePanelMessage.location) {
                        const command: ExtensionToAsbPlayerCommand<CloseSidePanelMessage> = {
                            sender: 'asbplayer-extension-to-player',
                            message: {
                                command: 'close-side-panel',
                            },
                        };
                        return command;
                    }
                    locationChanged = true;
                }

                return undefined;
            },
        });

        if (sidePanelOpen && locationChanged) {
            // Side panel is open, and we just want to change its location
            void setAppRequestedLocation(toggleSidePanelMessage.location);
        } else if (!sidePanelOpen) {
            void setAppRequestedLocation(toggleSidePanelMessage.location);
            browser.windows
                // @ts-ignore
                .getLastFocused((w) => {
                    const windowId = w.id;
                    browser.sidePanel.open({ windowId: windowId! });
                });
        }

        return false;
    }
}
