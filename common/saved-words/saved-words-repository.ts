import Dexie from 'dexie';
import { v4 as uuidv4 } from 'uuid';

export interface SavedWord {
    id: string;
    word: string;
    sentence: string;
    translation: string;
    timestamp: number;
    videoTitle?: string;
    videoUrl?: string;
}

interface SavedWordRecord extends SavedWord {
    index?: number;
}

class SavedWordsDatabase extends Dexie {
    savedWords!: Dexie.Table<SavedWordRecord, number>;

    constructor() {
        super('SavedWordsDatabase');
        this.version(1).stores({
            savedWords: '++index,id,timestamp',
        });
    }
}

export interface SavedWordsRepository {
    save: (word: Omit<SavedWord, 'id' | 'timestamp'>) => Promise<SavedWord>;
    getAll: () => Promise<SavedWord[]>;
    getCount: () => Promise<number>;
    clear: () => Promise<void>;
    delete: (id: string) => Promise<void>;
    exportToCsv: () => Promise<string>;
}

export class IndexedDBSavedWordsRepository implements SavedWordsRepository {
    private readonly _db = new SavedWordsDatabase();

    async save(wordData: Omit<SavedWord, 'id' | 'timestamp'>): Promise<SavedWord> {
        const record: SavedWordRecord = {
            id: uuidv4(),
            timestamp: Date.now(),
            word: wordData.word,
            sentence: wordData.sentence,
            translation: wordData.translation,
            videoTitle: wordData.videoTitle,
            videoUrl: wordData.videoUrl,
        };

        await this._db.savedWords.put(record);
        return record;
    }

    async getAll(): Promise<SavedWord[]> {
        const result = await this._db.savedWords.orderBy('timestamp').toArray();
        return result;
    }

    async getCount(): Promise<number> {
        return await this._db.savedWords.count();
    }

    async clear(): Promise<void> {
        await this._db.savedWords.clear();
    }

    async delete(id: string): Promise<void> {
        const keys = await this._db.savedWords.where('id').equals(id).primaryKeys();
        await this._db.savedWords.bulkDelete(keys);
    }

    async exportToCsv(): Promise<string> {
        const words = await this.getAll();

        if (words.length === 0) {
            return 'word,sentence,timestamp,videoTitle,videoId\n';
        }

        const escapeCSV = (str: string | undefined): string => {
            if (str === undefined) return '';
            // Escape double quotes by doubling them, and wrap in quotes if contains comma, newline, or quotes
            const escaped = str.replace(/"/g, '""');
            if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"') || escaped.includes('\r')) {
                return `"${escaped}"`;
            }
            return escaped;
        };

        const extractVideoId = (url: string | undefined): string => {
            if (!url) return '';
            // YouTube: https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID
            const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
            if (youtubeMatch) return youtubeMatch[1];
            // Return empty if no known pattern matches
            return '';
        };

        const header = 'word,sentence,timestamp,videoTitle,videoId';
        const rows = words.map((w) => {
            return [
                escapeCSV(w.word),
                escapeCSV(w.sentence),
                w.timestamp.toString(),
                escapeCSV(w.videoTitle),
                escapeCSV(extractVideoId(w.videoUrl)),
            ].join(',');
        });

        return [header, ...rows].join('\n');
    }
}
