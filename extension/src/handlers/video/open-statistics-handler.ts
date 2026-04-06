import { Command, Message } from '@project/common';
import TabRegistry from '../../services/tab-registry';
import { setExtensionRequestedLocation } from '@/services/side-panel';
import { isFirefoxBuild } from '@/services/build-flags';

export default class OpenStatisticsHandler {
    private readonly _tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this._tabRegistry = tabRegistry;
    }

    get sender() {
        return ['asbplayer-video'];
    }

    get command() {
        return 'open-statistics';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        if (isFirefoxBuild) {
            void setExtensionRequestedLocation('statistics');

            this._tabRegistry
                .findAsbplayer({
                    filter: (a) => a.sidePanel ?? false,
                    allowTabCreation: false,
                })
                .then((sidePanelAsbplayerId) => {
                    if (sidePanelAsbplayerId === undefined) {
                        // TODO open a popup
                    }
                });
        } else if (browser.sidePanel !== undefined) {
            void setExtensionRequestedLocation('statistics');

            browser.windows
                // @ts-ignore
                .getLastFocused((w) => {
                    const windowId = w.id;
                    browser.sidePanel.open({ windowId: windowId! });
                });
        } else {
            // TODO open a popup
        }

        return false;
    }
}
