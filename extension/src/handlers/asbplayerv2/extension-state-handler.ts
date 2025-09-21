import { settingsPageConfigs } from '@/services/pages';
import { Command, Message } from '@project/common';

export default class ExtensionStateHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'extension-state';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        if (browser.commands === undefined) {
            sendResponse({});
            return false;
        }

        browser.commands.getAll((commands) => {
            const commandsObj: any = {};

            for (const c of commands) {
                if (c.name && c.shortcut) {
                    commandsObj[c.name] = c.shortcut;
                }
            }

            sendResponse({ commands: commandsObj, pages: settingsPageConfigs });
        });

        return true;
    }
}
