import { VideoTabModel } from '@project/common';

const lastSyncedTabKey = 'sidePanelLastSyncedTab';
const fileIdsKey = (tabId: number, src: string) => `sidePanelFileIds_${tabId}_${src}`;

export class SidePanelStorage {
    async getFileIdForTabAndSrc(tabId: number, src: string): Promise<string | undefined> {
        const key = fileIdsKey(tabId, src);
        return (await chrome.storage.session.get(key))[key] as string | undefined;
    }

    async setFileIdForTabAndSrc(tabId: number, src: string, fileId: string): Promise<void> {
        await chrome.storage.session.set({ [fileIdsKey(tabId, src)]: fileId });
    }

    async getLastSyncedTab(): Promise<VideoTabModel | undefined> {
        return (await chrome.storage.session.get(lastSyncedTabKey))[lastSyncedTabKey];
    }

    async setLastSyncedTab(tab: VideoTabModel): Promise<void> {
        await chrome.storage.session.set({ sidePanelLastSyncedTab: tab });
    }
}
