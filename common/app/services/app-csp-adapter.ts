import { CspAdapter, CspAdapterEventName } from '../../csp-adapter';
import { PageSettings } from '../../settings';
import ChromeExtension from './chrome-extension';

export class AppCspAdapter implements CspAdapter {
    private readonly _extension: ChromeExtension;
    private readonly _eventHandlers: ((eventName: CspAdapterEventName) => void)[] = [];

    constructor(extension: ChromeExtension) {
        this._extension = extension;
    }

    isCspDisabled: (pageKey: keyof PageSettings) => Promise<boolean> = (pageKey) => {
        return this._extension.isCspDisabled(pageKey);
    };

    enableCsp: (pageKey: keyof PageSettings) => Promise<void> = (pageKey) => {
        return this._extension.toggleCsp(pageKey, false).then(() => this._publishEvent('toggle'));
    };

    disableCsp: (pageKey: keyof PageSettings) => Promise<void> = (pageKey) => {
        return this._extension.toggleCsp(pageKey, true).then(() => this._publishEvent('toggle'));
    };

    private _publishEvent(eventName: CspAdapterEventName) {
        for (const h of this._eventHandlers) {
            h(eventName);
        }
    }

    onEvent: (handler: (eventName: CspAdapterEventName) => void) => () => void = (handler) => {
        this._eventHandlers.push(handler);
        return () => {
            for (let i = this._eventHandlers.length - 1; i >= 0; --i) {
                if (handler === this._eventHandlers[i]) {
                    this._eventHandlers.splice(i, 1);
                    break;
                }
            }
        };
    };
}
