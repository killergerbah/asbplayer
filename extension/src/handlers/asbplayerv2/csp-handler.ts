import { ExtensionCspAdapter } from '@/services/extension-csp-adapter';
import { CheckCspMessage, CheckCspResponse, Command, Message, ToggleCspMessage } from '@project/common';
import { CspAdapter } from '@project/common/csp-adapter';
import { PageSettings } from '@project/common/settings';

export class ToggleCspHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'toggle-csp';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const toggleCspMessage = command.message as ToggleCspMessage;
        if (toggleCspMessage.disable) {
            new ExtensionCspAdapter()
                .disableCsp(toggleCspMessage.pageKey as keyof PageSettings)
                .then(() => sendResponse(undefined));
        } else {
            new ExtensionCspAdapter()
                .enableCsp(toggleCspMessage.pageKey as keyof PageSettings)
                .then(() => sendResponse(undefined));
        }
        return true;
    }
}

export class CheckCspHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'check-csp';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const checkCspMessage = command.message as CheckCspMessage;
        new ExtensionCspAdapter().isCspDisabled(checkCspMessage.pageKey as keyof PageSettings).then((disabled) => {
            const resp: CheckCspResponse = { disabled };
            sendResponse(resp);
        });
        return true;
    }
}
