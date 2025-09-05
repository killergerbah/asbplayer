type MiningEvent =
    | 'started-mining'
    | 'stopped-mining'
    | 'bulk-export-started'
    | 'bulk-export-completed'
    | 'bulk-export-item-completed'
    | 'bulk-export-cancelled';
type Callback = () => void;

export interface BulkExportItem {
    subtitle: import('../../src/model').SubtitleModel;
    index: number;
}

export class MiningContext {
    private readonly _callbacks: { [event in MiningEvent]: Callback[] } = {
        'started-mining': [],
        'stopped-mining': [],
        'bulk-export-started': [],
        'bulk-export-completed': [],
        'bulk-export-item-completed': [],
        'bulk-export-cancelled': [],
    };
    private _mining = false;
    private _bulkExporting = false;
    private _bulkExportCancelled = false;
    private _bulkExportQueue: BulkExportItem[] = [];
    private _currentBulkExportIndex = 0;

    get mining() {
        return this._mining;
    }

    get bulkExporting() {
        return this._bulkExporting;
    }

    get bulkExportCancelled() {
        return this._bulkExportCancelled;
    }

    get bulkExportQueue() {
        return this._bulkExportQueue;
    }

    get currentBulkExportIndex() {
        return this._currentBulkExportIndex;
    }

    isBulkExportCancelled() {
        return this._bulkExportCancelled;
    }

    get bulkExportProgress() {
        if (!this._bulkExporting || this._bulkExportQueue.length === 0) {
            return { current: 0, total: 0, remaining: 0 };
        }
        
        const totalRemaining = this._bulkExportQueue.length;
        const currentProgress = this._currentBulkExportIndex;
        const remaining = Math.max(0, totalRemaining - currentProgress);
        
        return {
            current: currentProgress,
            total: totalRemaining,
            remaining: remaining
        };
    }

    onEvent(event: MiningEvent, callback: Callback) {
        this._callbacks[event].push(callback);
        return () => this._remove(callback, this._callbacks[event]);
    }

    started() {
        this._mining = true;
        this._callbacks['started-mining'].forEach((c) => c());
    }

    stopped() {
        this._mining = false;
        this._callbacks['stopped-mining'].forEach((c) => c());
    }

    startBulkExport(items: BulkExportItem[], startIndex: number = 0) {
        this._bulkExporting = true;
        this._bulkExportCancelled = false;
        this._bulkExportQueue = startIndex > 0 ? items.slice(startIndex) : items;
        this._currentBulkExportIndex = 0;
        
        this._callbacks['bulk-export-started'].forEach((c) => c());
    }

    completeBulkExportItem() {
        this._currentBulkExportIndex++;
        
        this._callbacks['bulk-export-item-completed'].forEach((c) => c());
        
        if (this._currentBulkExportIndex >= this._bulkExportQueue.length) {
            this.completeBulkExport();
        }
    }

    completeBulkExport() {
        this._bulkExporting = false;
        this._bulkExportCancelled = false;
        this._bulkExportQueue = [];
        this._currentBulkExportIndex = 0;
        this._callbacks['bulk-export-completed'].forEach((c) => c());
    }

    cancelBulkExport() {
        if (this._bulkExportCancelled) {
            return;
        }
        
        this._bulkExportCancelled = true;
        this._bulkExporting = false;
        this._bulkExportQueue = [];
        this._currentBulkExportIndex = 0;
        
        this._callbacks['bulk-export-cancelled'].forEach((c) => c());
        
        // Force stop any ongoing mining operations
        this._mining = false;
        this._callbacks['stopped-mining'].forEach((c) => c());
    }

    // Removed unused processBulkExportQueue to reduce API surface

    private _remove(callback: Function, callbacks: Callback[]) {
        for (let i = callbacks.length - 1; i >= 0; --i) {
            if (callback === callbacks[i]) {
                callbacks.splice(i, 1);
                break;
            }
        }
    }
}
