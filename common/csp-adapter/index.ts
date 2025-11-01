import { PageSettings } from '../settings';

export type CspAdapterEventName = 'toggle';
export interface CspAdapter {
    isCspDisabled: (pageKey: keyof PageSettings) => Promise<boolean>;
    disableCsp: (pageKey: keyof PageSettings) => Promise<void>;
    enableCsp: (pageKey: keyof PageSettings) => Promise<void>;
    onEvent: (handler: (event: CspAdapterEventName) => void) => () => void;
}
