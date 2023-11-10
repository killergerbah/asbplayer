import { AudioModel, CopyHistoryItem, ImageModel, SubtitleModel } from '@project/common';
import Dexie, { liveQuery, Observable } from 'dexie';

class CopyHistoryDatabase extends Dexie {
    copyHistoryItems!: Dexie.Table<CopyHistoryRecord, number>;

    constructor() {
        super('CopyHistoryDatabase');
        this.version(1).stores({
            copyHistoryItems: '++index,id,timestamp',
        });
    }
}

interface CopyHistoryRecord extends SubtitleModel {
    index?: number;
    name: string;
    id: string;
    timestamp: number;
    surroundingSubtitles: SubtitleModel[];
    audioTrack?: string;
    filePlaybackRate?: number;
    subtitleFileName?: string;
    videoFileName?: string;
    audioFileName?: string;
    mediaTimestamp?: number;
    audio?: AudioModel;
    image?: ImageModel;
    url?: string;
}

export default class CopyHistoryRepository {
    private readonly _db = new CopyHistoryDatabase();
    private _limit: number;

    constructor(limit: number) {
        this._limit = limit;
    }

    set limit(limit: number) {
        this._limit = limit;
    }

    async clear() {
        await this._db.delete();
    }

    async fetch(count: number): Promise<CopyHistoryItem[]> {
        if (count <= 0) {
            return [];
        }

        const result = await await this._db.copyHistoryItems.reverse().limit(count).toArray();
        result.reverse();
        return result;
    }

    liveFetch(count: number): Observable<CopyHistoryItem[]> {
        return liveQuery(() => {
            return this.fetch(count);
        });
    }

    async save(item: CopyHistoryItem) {
        if (this._limit <= 0) {
            return;
        }

        const {
            text,
            textImage,
            start,
            end,
            originalStart,
            originalEnd,
            track,
            name,
            id,
            timestamp,
            surroundingSubtitles,
            audioTrack,
            filePlaybackRate,
            videoFile,
            audioFile,
            subtitleFileName,
            mediaTimestamp,
            audio,
            image,
            url,
        } = item;
        const record: CopyHistoryRecord = {
            text,
            textImage,
            start,
            end,
            originalStart,
            originalEnd,
            track,
            name,
            id,
            timestamp,
            surroundingSubtitles,
            audioTrack,
            filePlaybackRate,
            videoFileName: videoFile?.name,
            audioFileName: audioFile?.name,
            subtitleFileName,
            mediaTimestamp,
            audio,
            image,
            url,
        };
        const existingPrimaryKeys = await this._db.copyHistoryItems.where('id').equals(item.id).primaryKeys();

        if (existingPrimaryKeys.length > 0) {
            record.index = existingPrimaryKeys[0];
        }

        const index = await this._db.copyHistoryItems.put(record);
        await this._prune(index);
    }

    private async _prune(lastIndex: number) {
        const size = await this._db.copyHistoryItems.count();

        if (size > this._limit) {
            const keys = await this._db.copyHistoryItems
                .where('index')
                .belowOrEqual(lastIndex - this._limit)
                .primaryKeys();

            if (keys.length > 0) {
                await this._db.copyHistoryItems.bulkDelete(keys);
            }
        }
    }

    async delete(id: string) {
        const keys = await this._db.copyHistoryItems.where('id').equals(id).primaryKeys();
        await this._db.copyHistoryItems.bulkDelete(keys);
    }
}
