import {
    CardModel,
    CardSavedMessage,
    CardUpdatedMessage,
    CopyMessage,
    ExtensionToBackgroundPageCommand,
    ExtensionToVideoCommand,
    PostMineAction,
    ShowAnkiUiMessage,
} from '@project/common';
import { humanReadableTime } from '@project/common/util';
import { AnkiSettings, ankiSettingsKeys, SettingsProvider } from '@project/common/settings';
import BackgroundPageManager from './background-page-manager';
import { v4 as uuidv4 } from 'uuid';
import { updateLastCard } from '@project/common/anki';

export class CardPublisher {
    private readonly _backgroundPageManager: BackgroundPageManager;
    private readonly _settingsProvider: SettingsProvider;
    constructor(backgroundPageManager: BackgroundPageManager, settingsProvider: SettingsProvider) {
        this._backgroundPageManager = backgroundPageManager;
        this._settingsProvider = settingsProvider;
    }

    async publish(card: CardModel, postMineAction?: PostMineAction, tabId?: number, src?: string) {
        const id = uuidv4();
        const savePromise = this._saveCardToRepository(id, card);

        if (tabId === undefined || src === undefined) {
            return;
        }

        if (postMineAction == PostMineAction.showAnkiDialog) {
            const showAnkiUiCommand: ExtensionToVideoCommand<ShowAnkiUiMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    ...card,
                    id,
                    command: 'show-anki-ui',
                },
                src,
            };

            chrome.tabs.sendMessage(tabId, showAnkiUiCommand);
        } else if (postMineAction == PostMineAction.updateLastCard) {
            const cardName = await updateLastCard(
                card,
                (await this._settingsProvider.get(ankiSettingsKeys)) as AnkiSettings
            );

            const cardUpdatedCommand: ExtensionToVideoCommand<CardUpdatedMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'card-updated',
                    cardName: `${cardName}`,
                    subtitle: card.subtitle,
                    surroundingSubtitles: card.surroundingSubtitles,
                    audio: card.audio,
                    image: card.image,
                    url: card.url,
                },
                src,
            };

            chrome.tabs.sendMessage(tabId, cardUpdatedCommand);
        } else if (postMineAction == PostMineAction.none) {
            savePromise.then((saved: boolean) => {
                if (saved) {
                    const cardSavedCommand: ExtensionToVideoCommand<CardSavedMessage> = {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'card-saved',
                            text: card.subtitle.text || humanReadableTime(card.mediaTimestamp),
                        },
                        src: src,
                    };

                    chrome.tabs.sendMessage(tabId, cardSavedCommand);
                }
            });
        }
    }

    private async _saveCardToRepository(id: string, card: CardModel) {
        try {
            const backgroundPageCopyCommand: ExtensionToBackgroundPageCommand<CopyMessage> = {
                sender: 'asbplayer-extension-to-background-page',
                message: { ...card, id, command: 'copy' },
            };
            const tabId = await this._backgroundPageManager.tabId();

            if (tabId !== undefined) {
                return await chrome.tabs.sendMessage(tabId, backgroundPageCopyCommand);
            }

            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
}
