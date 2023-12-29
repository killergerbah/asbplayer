import { useEffect, useMemo, useCallback, useState } from 'react';
import { CopyHistoryItem } from '@project/common';
import { CopyHistoryRepository } from '@project/common/copy-history';

export const useCopyHistory = (miningHistoryStorageLimit: number) => {
    const copyHistoryRepository = useMemo(
        () => new CopyHistoryRepository(miningHistoryStorageLimit),
        [miningHistoryStorageLimit]
    );
    const [copyHistoryItems, setCopyHistoryItems] = useState<CopyHistoryItem[]>([]);
    const updateCopyHistoryItems = useCallback((items: CopyHistoryItem[]) => {
        setCopyHistoryItems((existing: CopyHistoryItem[]) => {
            const newItems = [...existing];

            for (const item of items) {
                if (existing.find((i) => i.id === item.id) === undefined) {
                    newItems.push(item);
                }
            }

            return newItems;
        });
    }, []);

    const refreshCopyHistory = useCallback(async () => {
        updateCopyHistoryItems(await copyHistoryRepository.fetch(miningHistoryStorageLimit));
    }, [miningHistoryStorageLimit, updateCopyHistoryItems, copyHistoryRepository]);

    useEffect(() => {
        const observable = copyHistoryRepository.liveFetch(miningHistoryStorageLimit);
        const subscription = observable.subscribe(updateCopyHistoryItems);
        return () => subscription.unsubscribe();
    }, [copyHistoryRepository, miningHistoryStorageLimit, updateCopyHistoryItems]);

    const deleteCopyHistoryItem = useCallback(
        async (item: CopyHistoryItem) => {
            const newCopyHistoryItems: CopyHistoryItem[] = [];

            for (const i of copyHistoryItems) {
                if (item.id !== i.id) {
                    newCopyHistoryItems.push(i);
                }
            }

            setCopyHistoryItems(newCopyHistoryItems);
            await copyHistoryRepository.delete(item.id);
        },
        [copyHistoryItems, copyHistoryRepository]
    );

    const saveCopyHistoryItem = useCallback(
        async (item: CopyHistoryItem) => {
            setCopyHistoryItems((items) => [...items, item]);
            await copyHistoryRepository.save(item);
        },
        [copyHistoryRepository]
    );

    return { copyHistoryItems, refreshCopyHistory, deleteCopyHistoryItem, saveCopyHistoryItem };
};
