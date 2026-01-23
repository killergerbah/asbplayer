const DB_NAME = 'asbplayer-transcript-cache';
const DB_VERSION = 1;
const STORE_NAME = 'transcripts';

interface CachedTranscript {
    videoId: string;
    srt: string;
    createdAt: number;
}

function extractVideoId(url: string): string | null {
    try {
        const urlObj = new URL(url);

        // Handle youtube.com/watch?v=ID
        if (urlObj.hostname.includes('youtube.com')) {
            return urlObj.searchParams.get('v');
        }

        // Handle youtu.be/ID
        if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.slice(1);
        }

        return null;
    } catch {
        return null;
    }
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'videoId' });
            }
        };
    });
}

export async function getCachedTranscript(videoUrl: string): Promise<string | null> {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) return null;

    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(videoId);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result as CachedTranscript | undefined;
                resolve(result?.srt ?? null);
            };
        });
    } catch (error) {
        console.error('Failed to get cached transcript:', error);
        return null;
    }
}

export async function cacheTranscript(videoUrl: string, srt: string): Promise<void> {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) return;

    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const data: CachedTranscript = {
                videoId,
                srt,
                createdAt: Date.now(),
            };

            const request = store.put(data);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (error) {
        console.error('Failed to cache transcript:', error);
    }
}

export async function clearTranscriptCache(): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (error) {
        console.error('Failed to clear transcript cache:', error);
    }
}

export async function getAllCachedTranscripts(): Promise<CachedTranscript[]> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result as CachedTranscript[]);
        });
    } catch (error) {
        console.error('Failed to get all cached transcripts:', error);
        return [];
    }
}

export async function getTranscriptCacheCount(): Promise<number> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.count();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    } catch (error) {
        console.error('Failed to get transcript cache count:', error);
        return 0;
    }
}
