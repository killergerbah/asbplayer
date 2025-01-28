import { GlobalState, GlobalStateProvider, initialGlobalState } from '@project/common/global-state';

export class ExtensionGlobalStateProvider implements GlobalStateProvider {
    async getAll() {
        return (await chrome.storage.local.get(initialGlobalState)) as GlobalState;
    }

    async get<K extends keyof GlobalState>(keys: K[]) {
        const partialInitialGlobalState: Partial<GlobalState> = {};

        for (const key of keys) {
            partialInitialGlobalState[key] = initialGlobalState[key];
        }

        return (await chrome.storage.local.get(partialInitialGlobalState)) as Pick<GlobalState, K>;
    }

    async set(state: Partial<GlobalState>) {
        await chrome.storage.local.set(state);
    }
}
