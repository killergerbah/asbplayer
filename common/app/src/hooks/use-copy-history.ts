import { useMemo, useCallback, useState } from 'react';
import { CopyHistoryItem, CopyHistoryRepository } from '@project/common';

export const useCopyHistory = (miningHistoryStorageLimit: number) => {
    const copyHistoryRepository = useMemo(
        () => new CopyHistoryRepository(miningHistoryStorageLimit),
        [miningHistoryStorageLimit]
    );
    const [copyHistoryItems, setCopyHistoryItems] = useState<CopyHistoryItem[]>([]);

    const refreshCopyHistory = useCallback(async () => {
        setCopyHistoryItems(await copyHistoryRepository.fetch(miningHistoryStorageLimit));
    }, [miningHistoryStorageLimit]);

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
        [copyHistoryItems]
    );

    const saveCopyHistoryItem = useCallback(async (item: CopyHistoryItem) => {
        setCopyHistoryItems((items) => [...items, item]);
        await copyHistoryRepository.save(item);
    }, []);

    return { copyHistoryItems, refreshCopyHistory, deleteCopyHistoryItem, saveCopyHistoryItem };
};
