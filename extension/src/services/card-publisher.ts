import { asbError } from '@project/common/util/log';
import { humanReadableTime, extractText, sourceString } from '@project/common/util';
import type {
    CardExportedMessage,
    CardModel,
    CardSavedMessage,
    CardUpdatedMessage,
    ExtensionToVideoCommand,
    NotifyErrorMessage,
    ShowAnkiUiMessage,
    ShowCardSelectUiMessage,
} from '@project/common';
import { PostMineAction, MediaFragment } from '@project/common';
import { AudioClip } from '@project/common/audio-clip';
import { highlightJitenWord, jitenOutcomeMessage } from '@project/common/jiten/jiten';
import type { JitenPending } from '@project/common/jiten/jiten';
import i18n from 'i18next';
import { getJitenClient } from '@project/extension/src/services/jiten-client';
import type { AnkiSettings, SettingsProvider } from '@project/common/settings';
import { ankiSettingsKeys, jitenSettingsKeys } from '@project/common/settings';
import { v4 as uuidv4 } from 'uuid';
import { exportCard, DuplicateNoteError } from '@project/common/anki';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history';

export class CardPublisher {
    private readonly _settingsProvider: SettingsProvider;
    bulkExportCancelled = false;
    private _jitenSubmitting = false;

    constructor(settingsProvider: SettingsProvider) {
        this._settingsProvider = settingsProvider;
    }

    async publish(card: CardModel, postMineAction?: PostMineAction, tabId?: number, src?: string, noteId?: number) {
        const id = uuidv4();
        const savePromise = this._saveCardToRepository(id, card);

        if (tabId === undefined || src === undefined) {
            return;
        }

        try {
            const destination = card.miningDestination ?? (await this._settingsProvider.getSingle('miningDestination'));
            if (destination === 'jiten' && postMineAction !== PostMineAction.none && postMineAction !== undefined) {
                const captured = { ...card, miningDestination: destination };
                if (
                    postMineAction === PostMineAction.updateLastCard ||
                    postMineAction === PostMineAction.mineNewJitenWords
                ) {
                    await this._attachJiten(captured, id, src, tabId, postMineAction);
                } else {
                    this._showAnkiDialog(captured, id, src, tabId);
                }
                return;
            }
            if (
                postMineAction == PostMineAction.showAnkiDialog ||
                postMineAction === PostMineAction.mineNewJitenWords
            ) {
                this._showAnkiDialog({ ...card, miningDestination: destination }, id, src, tabId);
            } else if (postMineAction == PostMineAction.updateLastCard) {
                await this._updateCard(card, src, tabId, noteId);
            } else if (postMineAction === PostMineAction.showUpdateCardDialog) {
                this._showUpdateCardDialog(card, src, tabId);
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

    async publishBulk(card: CardModel, tabId?: number, src?: string) {
        const id = uuidv4();
        // (agloo) n.b. this could lead to out-of-order card saves if Anki is taking a while,
        // which matters to users if they plan on reviewing cards in save order. If we get reports of this,
        // consider putting a promise from here into a save queue.
        void this._saveCardToRepository(id, card);

        if (tabId === undefined || src === undefined) {
            return;
        }

        if (this.bulkExportCancelled) {
            return;
        }

        await this._exportCardBulk(card, src, tabId);
    }

    private _notifySaved(
        savePromise: Promise<any>,
        card: CardModel,
        src: string,
        tabId: number,
        notification?: string
    ) {
        void savePromise.then((saved: boolean) => {
            if (saved) {
                const cardSavedCommand: ExtensionToVideoCommand<CardSavedMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        ...card,
                        command: 'card-saved',
                        notification,
                        cardName: card.subtitle.text || humanReadableTime(card.mediaTimestamp),
                    },
                    src: src,
                };

                void browser.tabs.sendMessage(tabId, cardSavedCommand);
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

        void browser.tabs.sendMessage(tabId, cardExportedCommand);
    }

    private async _exportCardBulk(card: CardModel, src: string | undefined, tabId: number) {
        const ankiSettings = (await this._settingsProvider.get(ankiSettingsKeys)) as AnkiSettings;

        let cardName: string = '';
        try {
            cardName = await exportCard(card, ankiSettings, 'default');
        } catch (e) {
            if (e instanceof DuplicateNoteError) {
                // This shouldn't be reachable right now, since we've allowed duplicate note exports.
                // It's left in because without it we'd halt a bulk export on the first duplicate we
                // find, and duplicates are very easy to encounter on shorter sentences.
                const cardExportedCommand: ExtensionToVideoCommand<CardExportedMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        ...card,
                        command: 'card-exported',
                        cardName: '',
                        isBulkExport: true,
                        skippedDuplicate: true,
                    },
                    src,
                };
                void browser.tabs.sendMessage(tabId, cardExportedCommand);
                return;
            }
            // If we're in the middle of a bulk export, a failure will hang the app.
            // Signal an error and keep going to avoid this.
            const cardExportedCommand: ExtensionToVideoCommand<CardExportedMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    ...card,
                    command: 'card-exported',
                    cardName: '',
                    isBulkExport: true,
                    skippedDuplicate: false,
                    exportError: e instanceof Error ? e.message : 'Unknown error',
                },
                src,
            };
            void browser.tabs.sendMessage(tabId, cardExportedCommand);
            return;
        }

        const cardExportedCommand: ExtensionToVideoCommand<CardExportedMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                ...card,
                command: 'card-exported',
                cardName: `${cardName}`,
                isBulkExport: true,
            },
            src,
        };

        void browser.tabs.sendMessage(tabId, cardExportedCommand);
        void browser.runtime.sendMessage(cardExportedCommand);
    }

    private async _updateCard(card: CardModel, src: string | undefined, tabId: number, noteId?: number) {
        const ankiSettings = (await this._settingsProvider.get(ankiSettingsKeys)) as AnkiSettings;
        const cardName = await exportCard(
            card,
            ankiSettings,
            noteId === undefined ? 'updateLast' : 'updateSpecific',
            undefined,
            noteId
        );

        const cardUpdatedCommand: ExtensionToVideoCommand<CardUpdatedMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                ...card,
                command: 'card-updated',
                cardName: `${cardName}`,
            },
            src,
        };

        void browser.tabs.sendMessage(tabId, cardUpdatedCommand);
    }

    private async _attachJiten(card: CardModel, id: string, src: string, tabId: number, action: PostMineAction) {
        if (this._jitenSubmitting) return;
        this._jitenSubmitting = true;
        let pending: JitenPending | undefined;
        try {
            const settings = await this._settingsProvider.get([...jitenSettingsKeys]);
            const client = await getJitenClient(this._settingsProvider);
            if (action === PostMineAction.mineNewJitenWords) {
                pending = {
                    targets: await client.newWords(card.jitenWords ?? [], settings.jitenMiningDeckId),
                    deckId: settings.jitenMiningDeckId,
                };
                if (!pending.targets.length) {
                    this._notifySaved(Promise.resolve(true), card, src, tabId, String(i18n.t('jiten.noNewWords')));
                    return;
                }
            }
            const target = pending?.targets[0] ?? card.jitenTarget;
            if (!target) throw new Error(String(i18n.t('jiten.mineInReaderFirst')));
            const source = sourceString(card.subtitleFileName, card.subtitle.start);
            const params = {
                text: highlightJitenWord(card.text ?? extractText(card.subtitle, card.surroundingSubtitles), target),
                source,
                image:
                    settings.jitenAttachVisual && card.image
                        ? MediaFragment.fromBase64(
                              source,
                              card.subtitle.start,
                              card.image.base64,
                              card.image.extension,
                              card.image.error
                          )
                        : undefined,
                audioClip:
                    settings.jitenAttachAudio && card.audio
                        ? AudioClip.fromBase64(
                              source,
                              card.subtitle.start,
                              card.subtitle.end,
                              card.audio.playbackRate ?? 1,
                              card.audio.base64,
                              card.audio.extension,
                              card.audio.error
                          )
                        : undefined,
                track1: undefined,
                track2: undefined,
                track3: undefined,
                word: card.word,
                definition: card.definition,
                url: card.url,
                customFieldValues: card.customFieldValues ?? {},
                tags: [],
                mode: 'default' as const,
            };
            const submission = await client.submit(pending?.targets ?? [target], params, pending?.deckId);
            const last = submission.outcomes.at(-1)!;
            if (last.result.failed) {
                this._showAnkiDialog({ ...card, text: submission.text, jitenTarget: last.target }, id, src, tabId, {
                    jitenPending: pending ? { ...pending, targets: submission.remainingTargets } : undefined,
                    jitenResult: last.result,
                });
            } else {
                this._notifySaved(Promise.resolve(true), card, src, tabId, jitenOutcomeMessage(submission.outcomes));
            }
        } catch (error) {
            this._notifyError(error, src, tabId);
            this._showAnkiDialog(card, id, src, tabId, { jitenPending: pending });
        } finally {
            this._jitenSubmitting = false;
        }
    }

    private _showAnkiDialog(
        card: CardModel,
        id: string,
        src: string | undefined,
        tabId: number,
        retry?: Pick<ShowAnkiUiMessage, 'jitenPending' | 'jitenResult'>
    ) {
        const showAnkiUiCommand: ExtensionToVideoCommand<ShowAnkiUiMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                ...card,
                ...retry,
                id,
                command: 'show-anki-ui',
            },
            src,
        };

        void browser.tabs.sendMessage(tabId, showAnkiUiCommand);
    }

    private _showUpdateCardDialog(card: CardModel, src: string | undefined, tabId: number) {
        const showCardSelectUiCommand: ExtensionToVideoCommand<ShowCardSelectUiMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                ...card,
                command: 'show-card-select-ui',
            },
            src,
        };

        void browser.tabs.sendMessage(tabId, showCardSelectUiCommand);
    }

    private async _saveCardToRepository(id: string, card: CardModel) {
        try {
            const storageLimit = await this._settingsProvider.getSingle('miningHistoryStorageLimit');
            await new IndexedDBCopyHistoryRepository(storageLimit).save({
                ...card,
                id: card.id ?? id,
                timestamp: Date.now(),
            });
            return true;
        } catch (e) {
            asbError('copy-history', e);
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
        void browser.tabs.sendMessage(tabId, notifyErrorCommand);
    }
}
