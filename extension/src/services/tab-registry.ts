import {
    ActiveVideoElement,
    AsbplayerInstance,
    Command,
    ExtensionToAsbPlayerCommandTabsCommand,
    ExtensionToVideoCommand,
    Message,
    SettingsProvider,
    VideoTabModel,
} from '@project/common';

interface SlimTab {
    id: number;
    title: string;
    url: string;
}

export interface Asbplayer {
    id: string;
    tab?: SlimTab;
    sidePanel?: boolean;
    timestamp: number;
    receivedTabs?: ActiveVideoElement[];
    videoPlayer: boolean;
}

export interface VideoElement {
    src: string;
    tab: SlimTab;
    timestamp: number;
    subscribed: boolean;
    synced: boolean;
    syncedTimestamp?: number;
}

export default class TabRegistry {
    private readonly _settings: SettingsProvider;
    private _onNoSyncedElementsCallback?: () => void;
    private _onSyncedElementCallback?: () => void;
    private _onAsbplayerInstanceCallback?: () => void;

    constructor(settings: SettingsProvider) {
        this._settings = settings;

        // Update video element state on tab changes
        // Triggers events for when synced video elements appear/disappear
        chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
            this._videoElements();
        });
        chrome.tabs.onUpdated.addListener((tabId, removeInfo) => {
            this._videoElements();
        });
    }

    private async _fetchVideoElementState(): Promise<{ [key: string]: VideoElement }> {
        return (
            ((await chrome.storage.session.get('tabRegistryVideoElements')).tabRegistryVideoElements as {
                [key: string]: VideoElement;
            }) ?? {}
        );
    }

    private async _saveVideoElementState(state: { [key: string]: VideoElement }) {
        await chrome.storage.session.set({ tabRegistryVideoElements: state });
    }

    private async _videoElements(mutator?: (videoElements: { [key: string]: VideoElement }) => boolean) {
        const tabs = await chrome.tabs.query({});
        const videoElements = await this._fetchVideoElementState();
        const oldVideoElements = { ...videoElements };

        let changed = false;

        for (const id in videoElements) {
            const videoElement = videoElements[id];
            const disappeared =
                tabs.find((t) => t.id === videoElement.tab.id && t.url === videoElement.tab.url) === undefined;

            if (disappeared) {
                changed = true;
                delete videoElements[id];
            }
        }

        if (mutator !== undefined) {
            changed = changed || mutator(videoElements);
        }

        if (changed) {
            await this._saveVideoElementState(videoElements);
        }

        const oldSyncedElementExists = Object.values(oldVideoElements).find((v) => v.synced) !== undefined;
        const syncedElementExists = Object.values(videoElements).find((v) => v.synced) !== undefined;

        if (this._onNoSyncedElementsCallback !== undefined && oldSyncedElementExists && !syncedElementExists) {
            this._onNoSyncedElementsCallback();
        } else if (this._onSyncedElementCallback !== undefined && !oldSyncedElementExists && syncedElementExists) {
            this._onSyncedElementCallback();
        }

        return videoElements;
    }

    private async _fetchAsbplayerState(): Promise<{ [key: string]: Asbplayer }> {
        return (
            ((await chrome.storage.session.get('tabRegistryAsbplayers')).tabRegistryAsbplayers as {
                [key: string]: Asbplayer;
            }) ?? {}
        );
    }

    private async _saveAsbplayerState(state: { [key: string]: Asbplayer }) {
        await chrome.storage.session.set({ tabRegistryAsbplayers: state });
    }

    private async _asbplayers(mutator?: (asbplayers: { [key: string]: Asbplayer }) => boolean) {
        const tabs = await chrome.tabs.query({});
        const asbplayers = await this._fetchAsbplayerState();
        const oldAsbplayers = { ...asbplayers };
        const now = Date.now();
        let changed = false;

        for (const id in asbplayers) {
            const asbplayer = asbplayers[id];
            const disappeared =
                (asbplayer.sidePanel && now - asbplayer.timestamp >= 5000) ||
                (asbplayer.tab !== undefined &&
                    tabs.find((t) => t.id === asbplayer.tab?.id && t.url === asbplayer.tab?.url) === undefined);

            if (disappeared) {
                changed = true;
                delete asbplayers[id];
            }
        }

        if (mutator !== undefined) {
            changed = changed || mutator(asbplayers);
        }

        let newAsplayerAppeared = false;

        if (changed) {
            await this._saveAsbplayerState(asbplayers);
            newAsplayerAppeared = Object.keys(asbplayers).some((asbplayerId) => !(asbplayerId in oldAsbplayers));
        }

        if (newAsplayerAppeared) {
            this._onAsbplayerInstanceCallback?.();
        }

        return asbplayers;
    }

    async onAsbplayerHeartbeat(
        tab: chrome.tabs.Tab | undefined,
        asbplayerId: string,
        videoPlayer: boolean,
        sidePanel: boolean,
        receivedTabs?: ActiveVideoElement[]
    ) {
        this._updateAsbplayers(tab, asbplayerId, videoPlayer, sidePanel, receivedTabs);

        try {
            const command: ExtensionToAsbPlayerCommandTabsCommand = {
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'tabs',
                    tabs: await this._activeVideoElements(),
                    asbplayers: await this._asbplayerInstances(),
                    ackRequested: false,
                },
            };

            if (tab?.id) {
                await chrome.tabs.sendMessage(tab.id, command);
            } else {
                await chrome.runtime.sendMessage(command);
            }
        } catch (e) {
            // Swallow
        }
    }

    async onAsbplayerAckTabs(
        tab: chrome.tabs.Tab | undefined,
        asbplayerId: string,
        sidePanel: boolean,
        receivedTabs?: ActiveVideoElement[]
    ) {
        this._updateAsbplayers(tab, asbplayerId, false, sidePanel, receivedTabs);
    }

    private async _updateAsbplayers(
        tab: chrome.tabs.Tab | undefined,
        asbplayerId: string,
        videoPlayer: boolean,
        sidePanel: boolean,
        receivedTabs?: ActiveVideoElement[]
    ) {
        const slimTab =
            tab === undefined || tab.id === undefined
                ? undefined
                : {
                      id: tab.id,
                      title: tab.title ?? '',
                      url: tab.url ?? '',
                  };
        await this._asbplayers((asbplayers) => {
            asbplayers[asbplayerId] = {
                tab: slimTab,
                id: asbplayerId,
                timestamp: Date.now(),
                receivedTabs: receivedTabs,
                sidePanel: sidePanel,
                videoPlayer: videoPlayer,
            };
            return true;
        });
    }

    private async _activeVideoElements() {
        const videoElements = await this._videoElements();
        const activeVideoElements: ActiveVideoElement[] = [];

        for (const id in videoElements) {
            const videoElement = videoElements[id];

            if (videoElement.tab.id) {
                const element: VideoTabModel = {
                    id: videoElement.tab.id,
                    title: videoElement.tab.title,
                    src: videoElement.src,
                    subscribed: videoElement.subscribed,
                    synced: videoElement.synced,
                    syncedTimestamp: videoElement.syncedTimestamp,
                };
                activeVideoElements.push(element);
            }
        }

        return activeVideoElements;
    }

    private async _asbplayerInstances() {
        const asbplayers = await this._asbplayers();
        const asbplayerInstances: AsbplayerInstance[] = [];

        for (const asbplayer of Object.values(asbplayers)) {
            asbplayerInstances.push({
                id: asbplayer.id,
                tabId: asbplayer.tab?.id,
                sidePanel: asbplayer.sidePanel ?? false,
                timestamp: asbplayer.timestamp,
                videoPlayer: asbplayer.videoPlayer,
            });
        }

        return asbplayerInstances;
    }

    async onVideoElementHeartbeat(
        tab: chrome.tabs.Tab,
        src: string,
        subscribed: boolean,
        synced: boolean,
        syncedTimestamp?: number
    ) {
        if (tab.id === undefined) {
            return;
        }

        const tabId = tab.id;

        await this._videoElements((videoElements) => {
            videoElements[`${tab.id}:${src}`] = {
                tab: {
                    id: tabId,
                    title: tab.title ?? '',
                    url: tab.url ?? '',
                },
                src,
                subscribed,
                timestamp: Date.now(),
                synced,
                syncedTimestamp,
            };
            return true;
        });
    }

    async onVideoElementDisappeared(tab: chrome.tabs.Tab, src: string) {
        await this._videoElements((videoElements) => {
            const key = `${tab.id}:${src}`;

            if (key in videoElements) {
                delete videoElements[key];
                return true;
            }

            return false;
        });
    }

    onNoSyncedElements(callback: () => void) {
        this._onNoSyncedElementsCallback = callback;
    }

    onSyncedElement(callback: () => void) {
        this._onSyncedElementCallback = callback;
    }

    onAsbplayerInstance(callback: () => void) {
        this._onAsbplayerInstanceCallback = callback;
    }

    async publishTabsToAsbplayers() {
        const tabsCommand: ExtensionToAsbPlayerCommandTabsCommand = {
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'tabs',
                tabs: await this._activeVideoElements(),
                asbplayers: await this._asbplayerInstances(),
                ackRequested: true,
            },
        };

        await this.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => (asbplayer.videoPlayer ? undefined : tabsCommand),
        });
    }

    async publishCommandToAsbplayers<T extends Message>({
        asbplayerId,
        commandFactory,
    }: {
        commandFactory: (asbplayer: Asbplayer) => Command<T> | undefined;
        asbplayerId?: string;
    }) {
        const asbplayers = await this._asbplayers();

        if (asbplayerId !== undefined) {
            if (asbplayerId in asbplayers) {
                const asbplayer = asbplayers[asbplayerId];
                const command = commandFactory(asbplayer);

                if (command !== undefined) {
                    await this._sendCommand(asbplayers[asbplayerId], command);
                }
            }
        } else {
            for (const id in asbplayers) {
                const asbplayer = asbplayers[id];
                const command = commandFactory(asbplayer);

                if (command !== undefined) {
                    await this._sendCommand(asbplayer, command);
                }
            }
        }
    }

    private async _sendCommand<T extends Message>(asbplayer: Asbplayer, command: Command<T>) {
        try {
            if (asbplayer.tab?.id !== undefined) {
                await chrome.tabs.sendMessage(asbplayer.tab.id, command);
            } else if (asbplayer.sidePanel) {
                await chrome.runtime.sendMessage(command);
            }
        } catch (e) {
            // Swallow as this usually only indicates that the tab is not an asbplayer tab
        }
    }

    async publishCommandToVideoElements<T extends Message>(
        commandFactory: (videoElement: VideoElement) => ExtensionToVideoCommand<T> | undefined
    ) {
        const videoElements = await this._videoElements();

        for (const id in videoElements) {
            const videoElement = videoElements[id];
            const tabId = videoElement.tab.id;

            if (typeof tabId !== 'undefined') {
                const command = commandFactory(videoElement);

                if (command !== undefined) {
                    chrome.tabs.sendMessage(tabId, command);
                }
            }
        }
    }

    async publishCommandToVideoElementTabs<T extends Message>(
        commandFactory: (tab: SlimTab) => ExtensionToVideoCommand<T> | undefined
    ) {
        const videoElements = await this._videoElements();
        const tabs: SlimTab[] = [];

        for (const v of Object.values(videoElements)) {
            if (tabs.find((t) => t.id === v.tab.id) === undefined) {
                tabs.push(v.tab);
            }
        }

        if (tabs.length > 0) {
            for (const tab of tabs) {
                const command = commandFactory(tab);

                if (command !== undefined) {
                    chrome.tabs.sendMessage(tab.id, command);
                }
            }
        }
    }

    async findAsbplayer(filter?: (asbplayer: Asbplayer) => boolean): Promise<string> {
        let chosenAsbplayerId = null;
        const now = Date.now();
        let min = null;

        const asbplayers = await this._asbplayers();
        let asbplayerTabCount = 0;

        for (const id in asbplayers) {
            const asbplayer = asbplayers[id];

            if (!asbplayer.sidePanel) {
                ++asbplayerTabCount;
            }

            if (filter === undefined || filter(asbplayer)) {
                const elapsed = now - asbplayer.timestamp;

                if (min === null || elapsed < min) {
                    min = elapsed;
                    chosenAsbplayerId = asbplayer.id;
                }
            }
        }

        if (chosenAsbplayerId) {
            return chosenAsbplayerId;
        }

        return new Promise(async (resolve, reject) => {
            if (asbplayerTabCount === 0) {
                await this._createNewTab();
            }

            this._anyAsbplayerTab(resolve, reject, 0, 10, filter);
        });
    }

    async _createNewTab() {
        return new Promise<chrome.tabs.Tab>(async (resolve, reject) => {
            const activeTabs = await chrome.tabs.query({ active: true });
            const activeTabIndex = !activeTabs || activeTabs.length === 0 ? undefined : activeTabs[0].index + 1;
            chrome.tabs.create(
                {
                    active: false,
                    selected: false,
                    url: await this._settings.getSingle('streamingAppUrl'),
                    index: activeTabIndex,
                },
                resolve
            );
        });
    }

    async _anyAsbplayerTab(
        resolve: (value: string | PromiseLike<string>) => void,
        reject: (reason?: any) => void,
        attempt: number,
        maxAttempts: number,
        filter?: (asbplayer: Asbplayer) => boolean
    ) {
        if (attempt >= maxAttempts) {
            reject(new Error('Could not find or create an asbplayer tab'));
            return;
        }

        const asbplayers = await this._asbplayers();

        for (const id in asbplayers) {
            if (filter === undefined || filter(asbplayers[id])) {
                resolve(id);
                return;
            }
        }

        setTimeout(() => this._anyAsbplayerTab(resolve, reject, attempt + 1, maxAttempts, filter), 1000);
    }
}
