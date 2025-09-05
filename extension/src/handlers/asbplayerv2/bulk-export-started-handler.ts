import { CardPublisher } from '../../services/card-publisher';

export default class BulkExportStartedHandler {
    readonly sender = 'asbplayerv2';
    readonly command = 'bulk-export-started';
    
    constructor(private readonly _cardPublisher: CardPublisher) {}
    
    handle(request: any, sender: any, sendResponse: any): boolean {
        // Reset the card-publisher cancellation state
        this._cardPublisher.resetBulkExportCancellation();
        
        return false;
    }
}
