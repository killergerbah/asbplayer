import Dexie from 'dexie';
import pako from 'pako';

interface FileRecord {
    name: string;
    blob: Blob;
}

interface FileCollectionRecord {
    id: string;
    files: FileRecord[];
    metadata: any;
}

class FileDatabase extends Dexie {
    files!: Dexie.Table<FileCollectionRecord, string>;

    constructor() {
        super('FileDatabase');
        this.version(1).stores({
            files: 'id',
        });
    }
}

export default class FileRepository {
    private readonly _db: FileDatabase;

    constructor() {
        this._db = new FileDatabase();
    }

    async save(id: string, files: File[], metadata?: any) {
        this._db.files.put({ id, files: await Promise.all(files.map((f) => this.toFileRecord(f))), metadata });
    }

    async fetch(id: string): Promise<{ files: File[]; metadata: any }> {
        const results = await this._db.files.where('id').equals(id).toArray();

        if (results.length === 0) {
            return { files: [], metadata: undefined };
        }

        const record = results[0];
        return { files: await Promise.all(record.files.map((r) => this.fromFileRecord(r))), metadata: record.metadata };
    }

    private async toFileRecord(file: File) {
        const deflator = new pako.Deflate();
        deflator.push(await file.arrayBuffer(), true);
        return { name: file.name, blob: new Blob([deflator.result]) };
    }

    private async fromFileRecord(record: FileRecord) {
        const inflator = new pako.Inflate();
        inflator.push(await record.blob.arrayBuffer());
        return new File([inflator.result], record.name);
    }
}
