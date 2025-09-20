import { CardPublisher } from '../../services/card-publisher';

export default class BulkExportCancellationHandler {
    readonly sender = 'asbplayerv2';
    readonly command = 'bulk-export-cancelled';
    
    constructor(private readonly _cardPublisher: CardPublisher) {}
    
    handle(request: any, sender: any, sendResponse: any): boolean {
        // Check if we already processed this cancellation to prevent duplicate processing
        if (this._cardPublisher.bulkExportCancelled) {
            return false;
        }
        
        // Notify the card-publisher that bulk export was cancelled
        this._cardPublisher.setBulkExportCancelled(true);
        
        return false;
    }
}
