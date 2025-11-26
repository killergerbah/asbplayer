import { CspAdapter, CspAdapterEventName } from '@project/common/csp-adapter';
import { pageMetadata } from '@project/common/pages';
import { PageSettings } from '@project/common/settings';
import pagesConfig from '../pages.json';

class PageCspAdapter {
    private readonly _pageKey: keyof PageSettings;
    private _rule: Browser.declarativeNetRequest.Rule | undefined;

    constructor(pageKey: keyof PageSettings) {
        this._pageKey = pageKey;
    }

    refresh: () => Promise<void> = () => {
        if (browser.declarativeNetRequest) {
            return browser.declarativeNetRequest.getDynamicRules().then((rules) => {
                this._rule = rules.find((r) => r.id === pageMetadata[this._pageKey].disableCspRuleId);
            });
        }
        return new Promise((resolve) => resolve());
    };

    isCspDisabled: () => boolean = () => {
        return this._rule !== undefined;
    };

    disableCsp: () => Promise<void> = () => {
        if (!browser.declarativeNetRequest) {
            throw new Error('DNR not supported');
        }

        const ruleId = pageMetadata[this._pageKey].disableCspRuleId;
        const config = pagesConfig.pages.find((p) => p.key === this._pageKey);

        if (config === undefined) {
            throw new Error('Missing default page config for page key ' + this._pageKey);
        }

        return browser.declarativeNetRequest
            .updateDynamicRules({
                addRules: [
                    {
                        id: ruleId,
                        condition: {
                            regexFilter: config.host,
                            resourceTypes: [
                                'main_frame',
                                'sub_frame',
                                'stylesheet',
                                'script',
                                'image',
                                'font',
                                'object',
                                'xmlhttprequest',
                                'ping',
                                'csp_report',
                                'media',
                                'websocket',
                                'webtransport',
                                'webbundle',
                                'other',
                            ],
                        },
                        action: {
                            type: browser.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                            responseHeaders: [
                                {
                                    header: 'Content-Security-Policy',
                                    operation: browser.declarativeNetRequest.HeaderOperation.REMOVE,
                                },
                            ],
                        },
                    },
                ],
            })
            .then(this.refresh);
    };

    enableCsp: () => Promise<void> = () => {
        if (!browser.declarativeNetRequest) {
            return new Promise((resolve) => resolve());
        }

        const ruleId = pageMetadata[this._pageKey].disableCspRuleId;
        return browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId] }).then(this.refresh);
    };
}

export class ExtensionCspAdapter implements CspAdapter {
    private readonly _cache: { [key: string]: PageCspAdapter | undefined } = {};
    private readonly _eventHandlers: ((eventName: CspAdapterEventName) => void)[] = [];

    isCspDisabled: (pageKey: keyof PageSettings) => Promise<boolean> = async (pageKey) => {
        return (await this._pageAdapter(pageKey)).isCspDisabled();
    };

    enableCsp: (pageKey: keyof PageSettings) => Promise<void> = async (pageKey) => {
        return (await this._pageAdapter(pageKey)).enableCsp().then(() => this._publishEvent('toggle'));
    };

    disableCsp: (pageKey: keyof PageSettings) => Promise<void> = async (pageKey) => {
        return (await this._pageAdapter(pageKey)).disableCsp().then(() => this._publishEvent('toggle'));
    };

    private async _pageAdapter(pageKey: keyof PageSettings): Promise<PageCspAdapter> {
        let pageAdapter = this._cache[pageKey];

        if (!pageAdapter) {
            pageAdapter = new PageCspAdapter(pageKey);
            await pageAdapter.refresh();
            this._cache[pageKey] = pageAdapter;
        }

        return pageAdapter;
    }

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
