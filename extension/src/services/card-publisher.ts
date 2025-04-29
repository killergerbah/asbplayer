import {
    CardExportedMessage,
    CardModel,
    CardSavedMessage,
    CardUpdatedMessage,
    ExtensionToVideoCommand,
    NotifyErrorMessage,
    PostMineAction,
    ShowAnkiUiMessage,
} from '@project/common';
import { humanReadableTime } from '@project/common/util';
import { AnkiSettings, ankiSettingsKeys, SettingsProvider } from '@project/common/settings';
import { v4 as uuidv4 } from 'uuid';
import { exportCard } from '@project/common/anki';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history';

export class CardPublisher {
    private readonly _settingsProvider: SettingsProvider;
    constructor(settingsProvider: SettingsProvider) {
        this._settingsProvider = settingsProvider;
    }

    async publish(card: CardModel, postMineAction?: PostMineAction, tabId?: number, src?: string) {
        const id = uuidv4();
        const savePromise = this._saveCardToRepository(id, card);

        if (tabId === undefined || src === undefined) {
            return;
        }

        try {
            if (postMineAction == PostMineAction.showAnkiDialog) {
                this._showAnkiDialog(card, id, src, tabId);
            } else if (postMineAction == PostMineAction.updateLastCard) {
                await this._updateLastCard(card, src, tabId);
            } else if (postMineAction === PostMineAction.exportCard) {
                await this._exportCard(card, src, tabId);
            } else if (postMineAction === PostMineAction.none) {
                this._notifySaved(savePromise, card, src, tabId);
            }
        } catch (e) {
            this._notifyError(e, src, tabId);
            throw e;
        }
    }

    private _notifySaved(savePromise: Promise<any>, card: CardModel, src: string, tabId: number) {
        savePromise.then((saved: boolean) => {
            if (saved) {
                const cardSavedCommand: ExtensionToVideoCommand<CardSavedMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        ...card,
                        command: 'card-saved',
                        cardName: card.subtitle.text || humanReadableTime(card.mediaTimestamp),
                    },
                    src: src,
                };

                browser.tabs.sendMessage(tabId, cardSavedCommand);
            }
        });
    }

    private async _exportCard(card: CardModel, src: string | undefined, tabId: number) {
        const ankiSettings = (await this._settingsProvider.get(ankiSettingsKeys)) as AnkiSettings;
        const cardName = await exportCard(card, ankiSettings, 'default');

        const cardExportedCommand: ExtensionToVideoCommand<CardExportedMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                ...card,
                command: 'card-exported',
                cardName: `${cardName}`,
            },
            src,
        };

        browser.tabs.sendMessage(tabId, cardExportedCommand);
    }

    private async _updateLastCard(card: CardModel, src: string | undefined, tabId: number) {
        const ankiSettings = (await this._settingsProvider.get(ankiSettingsKeys)) as AnkiSettings;
        const cardName = await exportCard(card, ankiSettings, 'updateLast');

        const cardUpdatedCommand: ExtensionToVideoCommand<CardUpdatedMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                ...card,
                command: 'card-updated',
                cardName: `${cardName}`,
            },
            src,
        };

        browser.tabs.sendMessage(tabId, cardUpdatedCommand);
    }

    private _showAnkiDialog(card: CardModel, id: string, src: string | undefined, tabId: number) {
        const showAnkiUiCommand: ExtensionToVideoCommand<ShowAnkiUiMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                ...card,
                id,
                command: 'show-anki-ui',
            },
            src,
        };

        browser.tabs.sendMessage(tabId, showAnkiUiCommand);
    }

    private async _saveCardToRepository(id: string, card: CardModel) {
        try {
            const storageLimit = await this._settingsProvider.getSingle('miningHistoryStorageLimit');
            new IndexedDBCopyHistoryRepository(storageLimit).save({
                ...card,
                id: card.id ?? id,
                timestamp: Date.now(),
            });
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    private _notifyError(e: unknown, src: string | undefined, tabId: number) {
        let message: string;

        if (e instanceof Error) {
            message = e.message;
        } else if (typeof e === 'string') {
            message = e;
        } else {
            message = String(e);
        }

        const notifyErrorCommand: ExtensionToVideoCommand<NotifyErrorMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'notify-error',
                message,
            },
            src,
        };
        browser.tabs.sendMessage(tabId, notifyErrorCommand);
    }
}
