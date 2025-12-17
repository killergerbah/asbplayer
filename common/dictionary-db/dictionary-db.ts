import { Anki, NoteInfo } from '@project/common/anki';
import { DictionaryBuildAnkiCacheState } from '@project/common';
import {
    AsbplayerSettings,
    dictionaryStatusEnabled,
    DictionaryTokenSource,
    DictionaryTrack,
    TokenStatus,
} from '@project/common/settings';
import { HAS_LETTER_REGEX, inBatches, mapAsync } from '@project/common/util';
import { Yomitan } from '@project/common/yomitan/yomitan';
import Dexie from 'dexie';
import { v4 as uuidv4 } from 'uuid';

const BUILD_MIN_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * This gives a better user experience so they are free to switch between tracks long term
 * without any headaches. If in the future per track local tokens are desired as a new option,
 * then -1 would simply become the fallback and represent trackless tokens.
 */
const LOCAL_TOKEN_TRACK = -1; // null cannot be used in Dexie indexes

/**
 * Not currently used having states seems like it should exist
 */
export enum DictionaryTokenState {
    IGNORED = 0,
    TRACKED = 1,
}

/**
 * If adding/removing fields here, add/remove the UI helperText in the settings tab
 */
export interface AnkiCacheSettingsDependencies {
    ankiConnectUrl: string;
    dictionaryYomitanUrl: string;
    dictionaryYomitanScanLength: number;
    dictionaryAnkiWordFields: string[];
    dictionaryAnkiSentenceFields: string[];
    dictionaryAnkiMatureCutoff: number;
}

type DictionaryMetaKey = [string, number];
interface DictionaryMetaRecord {
    profile: string;
    track: number;
    lastBuildStartedAt: number;
    lastBuildExpiresAt: number;
    buildId: string | null;
    settings: string | null;
}

export type DictionaryTokenKey = [string, DictionaryTokenSource, number, string];
interface DictionaryTokenRecord {
    profile: string;
    track: number;
    source: DictionaryTokenSource;
    token: string;
    status: TokenStatus | null;
    lemmas: string[];
    states: DictionaryTokenState[];
    cardIds: number[];
}
export interface DictionaryLocalTokenInput {
    token: string;
    status: TokenStatus;
    lemmas: string[];
    states: DictionaryTokenState[];
}

type DictionaryAnkiCardKey = [number, number, string];
interface DictionaryAnkiCardRecord {
    profile: string;
    track: number;
    cardId: number;
    noteId: number;
    modifiedAt: number;
    status: TokenStatus;
    suspended: boolean;
}

class DictionaryDatabase extends Dexie {
    meta!: Dexie.Table<DictionaryMetaRecord, DictionaryMetaKey>;
    tokens!: Dexie.Table<DictionaryTokenRecord, DictionaryTokenKey>;
    ankiCards!: Dexie.Table<DictionaryAnkiCardRecord, DictionaryAnkiCardKey>;

    constructor() {
        super('DictionaryDatabase');
        this.version(1).stores({
            meta: '[profile+track]',
            tokens: '[token+source+track+profile],[profile+token],*lemmas,*cardIds',
            ankiCards: '[cardId+track+profile],[profile+noteId]',
        });
    }
}

type CardsForDB = Map<
    number,
    {
        noteId: number;
        fields: Map<string, string>;
        modifiedAt: number;
        statuses: Map<number, TokenStatus>;
        suspended: boolean;
    }
>;

interface TrackStateForDB {
    dt: DictionaryTrack;
    yomitan: Yomitan;
}

type TrackStatesForDB = Map<number, TrackStateForDB>;

export interface CardStatus {
    status: TokenStatus;
    suspended: boolean;
}

export interface TokenResults {
    [token: string]: { source: DictionaryTokenSource; statuses: CardStatus[]; states: DictionaryTokenState[] };
}

export interface LemmaResults {
    [lemma: string]: {
        token: string;
        source: DictionaryTokenSource;
        statuses: CardStatus[];
        states: DictionaryTokenState[];
    }[];
}

interface BuildAnkiCacheProgress {
    current: number;
    total: number;
    startedAt: number;
}

const command = 'dictionary-build-anki-cache-state';

export class DictionaryDB {
    private readonly db: DictionaryDatabase;

    constructor() {
        this.db = new DictionaryDatabase();
    }

    private _getProfile(inputProfile: string | undefined): string {
        return inputProfile ?? 'Default';
    }

    async getBulk(inputProfile: string | undefined, track: number, tokens: string[]): Promise<TokenResults> {
        if (!tokens.length) return {};
        const profile = this._getProfile(inputProfile);

        return this.db.transaction('r', this.db.tokens, this.db.ankiCards, async () => {
            return this.db.tokens
                .where('[profile+token]')
                .anyOf(tokens.map((token) => [profile, token]))
                .filter((r) => r.track === track || r.track === LOCAL_TOKEN_TRACK)
                .toArray()
                .then(async (records) => {
                    if (!records.length) return {};
                    const tokenRecordMap = new Map<string, DictionaryTokenRecord[]>();
                    for (const record of records) {
                        const val = tokenRecordMap.get(record.token);
                        if (val) val.push(record);
                        else tokenRecordMap.set(record.token, [record]);
                    }
                    const tokenResults: TokenResults = {};

                    // Prioritize local tokens
                    for (const [token, records] of tokenRecordMap.entries()) {
                        for (const record of records) {
                            if (record.source !== DictionaryTokenSource.LOCAL) continue;
                            tokenResults[token] = {
                                source: record.source,
                                statuses: [{ status: record.status!, suspended: false }],
                                states: record.states,
                            };
                            tokenRecordMap.delete(token);
                            break;
                        }
                    }
                    if (!tokenRecordMap.size) return tokenResults;

                    // Fetch Anki card statuses for remaining tokens
                    const cardStatusMap: Map<number, CardStatus> = await this.db.ankiCards
                        .where('[cardId+track+profile]')
                        .anyOf(
                            Array.from(
                                new Set(
                                    Array.from(tokenRecordMap.values()).flatMap((records) =>
                                        records.flatMap((record) => record.cardIds)
                                    )
                                )
                            ).map((cardId) => [cardId, track, profile])
                        )
                        .toArray()
                        .then((ankiCards) => {
                            if (!ankiCards.length) return new Map();
                            const cardStatusMap = new Map<number, CardStatus>();
                            for (const ankiCard of ankiCards) {
                                cardStatusMap.set(ankiCard.cardId, {
                                    status: ankiCard.status,
                                    suspended: ankiCard.suspended,
                                });
                            }
                            return cardStatusMap;
                        });

                    // Need to prioritize word cards over sentences
                    for (const [token, records] of tokenRecordMap.entries()) {
                        for (const record of records) {
                            if (record.source !== DictionaryTokenSource.ANKI_WORD) continue;
                            const statuses: CardStatus[] = [];
                            for (const cardId of record.cardIds) statuses.push(cardStatusMap.get(cardId)!);
                            tokenResults[token] = { source: record.source, statuses, states: record.states };
                            tokenRecordMap.delete(token);
                            break;
                        }
                    }
                    if (!tokenRecordMap.size) return tokenResults;

                    // Finally use sentence cards if needed
                    for (const [token, records] of tokenRecordMap.entries()) {
                        for (const record of records) {
                            if (record.source !== DictionaryTokenSource.ANKI_SENTENCE) continue;
                            const statuses: CardStatus[] = [];
                            for (const cardId of record.cardIds) statuses.push(cardStatusMap.get(cardId)!);
                            tokenResults[token] = { source: record.source, statuses, states: record.states };
                            tokenRecordMap.delete(token);
                            break;
                        }
                    }
                    return tokenResults;
                });
        });
    }

    async getByLemmaBulk(inputProfile: string | undefined, track: number, lemmas: string[]): Promise<LemmaResults> {
        if (!lemmas.length) return {};
        const lemmasSet = new Set(lemmas);
        const profile = this._getProfile(inputProfile);

        return this.db.transaction('r', this.db.tokens, this.db.ankiCards, async () => {
            return this.db.tokens
                .where('lemmas')
                .anyOf(lemmas)
                .distinct()
                .filter((r) => (r.track === track || r.track === LOCAL_TOKEN_TRACK) && r.profile === profile)
                .toArray()
                .then(async (records) => {
                    if (!records.length) return {};
                    const lemmaRecordMap = new Map<string, DictionaryTokenRecord[]>();
                    for (const record of records) {
                        for (const lemma of record.lemmas) {
                            if (!lemmasSet.has(lemma)) continue;
                            const val = lemmaRecordMap.get(lemma);
                            if (val) val.push(record);
                            else lemmaRecordMap.set(lemma, [record]);
                        }
                    }
                    const lemmaResults: LemmaResults = {};

                    // Prioritize local tokens
                    for (const [lemma, records] of lemmaRecordMap.entries()) {
                        for (const record of records) {
                            if (record.source !== DictionaryTokenSource.LOCAL) continue;
                            let arr = lemmaResults[lemma];
                            if (!arr) {
                                arr = [];
                                lemmaResults[lemma] = arr;
                            }
                            arr.push({
                                token: record.token,
                                source: record.source,
                                statuses: [{ status: record.status!, suspended: false }],
                                states: record.states,
                            });
                            lemmaRecordMap.delete(lemma);
                        }
                    }
                    if (!lemmaRecordMap.size) return lemmaResults;

                    // Fetch Anki card statuses for remaining tokens
                    const cardStatusMap: Map<number, CardStatus> = await this.db.ankiCards
                        .where('[cardId+track+profile]')
                        .anyOf(
                            Array.from(
                                new Set(
                                    Array.from(lemmaRecordMap.values()).flatMap((records) =>
                                        records.flatMap((record) => record.cardIds)
                                    )
                                )
                            ).map((cardId) => [cardId, track, profile])
                        )
                        .toArray()
                        .then((ankiCards) => {
                            if (!ankiCards.length) return new Map();
                            const cardStatusMap = new Map<number, CardStatus>();
                            for (const ankiCard of ankiCards) {
                                cardStatusMap.set(ankiCard.cardId, {
                                    status: ankiCard.status,
                                    suspended: ankiCard.suspended,
                                });
                            }
                            return cardStatusMap;
                        });

                    // Need to prioritize word cards over sentences
                    for (const [lemma, records] of lemmaRecordMap.entries()) {
                        for (const record of records) {
                            if (record.source !== DictionaryTokenSource.ANKI_WORD) continue;
                            let arr = lemmaResults[lemma];
                            if (!arr) {
                                arr = [];
                                lemmaResults[lemma] = arr;
                            }
                            const statuses: CardStatus[] = [];
                            for (const cardId of record.cardIds) statuses.push(cardStatusMap.get(cardId)!);
                            arr.push({ token: record.token, source: record.source, statuses, states: record.states });
                            lemmaRecordMap.delete(lemma);
                        }
                    }
                    if (!lemmaRecordMap.size) return lemmaResults;

                    // Finally use sentence cards if needed
                    for (const [lemma, records] of lemmaRecordMap.entries()) {
                        for (const record of records) {
                            if (record.source !== DictionaryTokenSource.ANKI_SENTENCE) continue;
                            const statuses: CardStatus[] = [];
                            for (const cardId of record.cardIds) statuses.push(cardStatusMap.get(cardId)!);
                            const arr = lemmaResults[lemma];
                            if (arr) {
                                arr.push({
                                    token: record.token,
                                    source: record.source,
                                    statuses,
                                    states: record.states,
                                });
                            } else {
                                lemmaResults[lemma] = [
                                    { token: record.token, source: record.source, statuses, states: record.states },
                                ];
                            }
                            lemmaRecordMap.delete(lemma);
                        }
                    }
                    return lemmaResults;
                });
        });
    }

    async saveRecordLocalBulk(
        inputProfile: string | undefined,
        localTokenInputs: DictionaryLocalTokenInput[]
    ): Promise<DictionaryTokenKey[]> {
        if (!localTokenInputs.length) return [];
        const profile = this._getProfile(inputProfile);
        return this.db.transaction('rw', this.db.tokens, async () => {
            const tokenRecordMap = await this._getFromSourceBulk(
                profile,
                LOCAL_TOKEN_TRACK,
                DictionaryTokenSource.LOCAL,
                localTokenInputs.map((l) => l.token)
            );

            const records: DictionaryTokenRecord[] = [];
            for (const localTokenInput of localTokenInputs) {
                if (!localTokenInput.token.length || !HAS_LETTER_REGEX.test(localTokenInput.token)) {
                    throw new Error(`Cannot save local token with invalid token: "${localTokenInput.token}"`);
                }
                const existingRecords = tokenRecordMap.get(localTokenInput.token) || [];
                for (const existingRecord of existingRecords) {
                    for (const existingState of existingRecord.states) {
                        if (!localTokenInput.states.includes(existingState)) localTokenInput.states.push(existingState);
                    }
                }
                if (!localTokenInput.lemmas.length) {
                    throw new Error(`Cannot save local token with no lemmas: "${localTokenInput.token}"`);
                }
                if (localTokenInput.status === TokenStatus.UNCOLLECTED && !localTokenInput.states.length) {
                    throw new Error(
                        `Cannot save local token with uncollected status and no states: "${localTokenInput.token}"`
                    );
                }
                records.push({
                    profile,
                    track: LOCAL_TOKEN_TRACK,
                    source: DictionaryTokenSource.LOCAL,
                    token: localTokenInput.token,
                    status: localTokenInput.status,
                    lemmas: localTokenInput.lemmas,
                    states: localTokenInput.states,
                    cardIds: [],
                });
            }
            return this._saveRecordBulk(records);
        });
    }

    async deleteRecordLocalBulk(inputProfile: string | undefined, tokens: string[]): Promise<number> {
        if (!tokens.length) return 0;
        const profile = this._getProfile(inputProfile);
        return this.db.tokens
            .where('[token+source+track+profile]')
            .anyOf(tokens.map((token) => [token, DictionaryTokenSource.LOCAL, LOCAL_TOKEN_TRACK, profile]))
            .delete();
    }

    async deleteProfile(profile: string): Promise<[number, number, number]> {
        return this.db.transaction('rw', this.db.meta, this.db.tokens, this.db.ankiCards, () =>
            Promise.all([
                this.db.meta.where('profile').equals(profile).delete(),
                this.db.tokens.where('profile').equals(profile).delete(),
                this.db.ankiCards.where('profile').equals(profile).delete(),
            ])
        );
    }

    private async _getFromSourceBulk(
        profile: string,
        track: number,
        source: DictionaryTokenSource,
        tokens: string[]
    ): Promise<Map<string, DictionaryTokenRecord[]>> {
        if (!tokens.length) return new Map();
        return this.db.tokens
            .where('[token+source+track+profile]')
            .anyOf(tokens.map((token) => [token, source, track, profile]))
            .toArray()
            .then((records) => {
                if (!records.length) return new Map();
                const tokenRecordMap = new Map<string, DictionaryTokenRecord[]>();
                for (const record of records) {
                    const val = tokenRecordMap.get(record.token);
                    if (val) val.push(record);
                    else tokenRecordMap.set(record.token, [record]);
                }
                return tokenRecordMap;
            });
    }

    private async _getAnkiCards(profile: string): Promise<DictionaryAnkiCardRecord[]> {
        return this.db.ankiCards.where('profile').equals(profile).toArray();
    }

    private async _getAnkiCardsByNoteIdBulk(
        profile: string,
        noteIds: number[]
    ): Promise<Map<number, DictionaryAnkiCardRecord[]>> {
        if (!noteIds.length) return new Map();
        return this.db.ankiCards
            .where('[profile+noteId]')
            .anyOf(noteIds.map((noteId) => [profile, noteId]))
            .toArray()
            .then((ankiCards) => {
                if (!ankiCards.length) return new Map();
                const noteIdRecordMap = new Map<number, DictionaryAnkiCardRecord[]>();
                for (const ankiCard of ankiCards) {
                    const val = noteIdRecordMap.get(ankiCard.noteId);
                    if (val) val.push(ankiCard);
                    else noteIdRecordMap.set(ankiCard.noteId, [ankiCard]);
                }
                return noteIdRecordMap;
            });
    }

    private async _saveRecordBulk(records: DictionaryTokenRecord[]): Promise<DictionaryTokenKey[]> {
        if (!records.length) return [];
        return this.db.tokens.bulkPut(records, { allKeys: true });
    }

    /**
     * There are four scenarios where tokens/cards need to be deleted:
     * 1. The card was removed from Anki (handled by _syncTrackStatesWithAnki())
     * 2. The card field was removed/renamed (handled by _syncTrackStatesWithAnki())
     * 3. The card field value no longer produce the same tokens (handled by _saveTokensForDB())
     * 4. Based on track settings such as no Anki fields (handled by tracksToClear)
     */
    private async _deleteCardBulk(
        profile: string,
        orphanedTrackCardIds: Map<number, number[]>,
        modifiedTokens: Set<string>
    ): Promise<void> {
        for (const [track, cardIds] of orphanedTrackCardIds.entries()) {
            if (!cardIds.length) orphanedTrackCardIds.delete(track);
        }
        if (!orphanedTrackCardIds.size) return;

        return this.db.transaction('rw', this.db.tokens, this.db.ankiCards, async () => {
            await mapAsync(Array.from(orphanedTrackCardIds.entries()), ([track, orphanedCardIds]) => {
                const cardIdsSet = new Set(orphanedCardIds);
                return Promise.all([
                    this.db.tokens
                        .where('cardIds')
                        .anyOf(orphanedCardIds)
                        .distinct()
                        .filter((r) => r.track === track && r.profile === profile)
                        .modify((record, ref) => {
                            const remainingCardIds = record.cardIds.filter((id) => !cardIdsSet.has(id));
                            if (!remainingCardIds.length) {
                                modifiedTokens.add(record.token);
                                for (const lemma of record.lemmas) modifiedTokens.add(lemma);
                                delete (ref as any).value;
                            } else if (remainingCardIds.length !== record.cardIds.length) {
                                modifiedTokens.add(record.token);
                                for (const lemma of record.lemmas) modifiedTokens.add(lemma);
                                record.cardIds = remainingCardIds;
                            }
                        }),
                    this.db.ankiCards
                        .where('[cardId+track+profile]')
                        .anyOf(orphanedCardIds.map((cardId) => [cardId, track, profile]))
                        .delete(),
                ]);
            });
        });
    }

    private async _orphanAllCardIds(profile: string, tracks: number[]): Promise<Map<number, number[]>> {
        if (!tracks.length) return new Map();
        const orphanedTrackCardIds = new Map<number, number[]>(tracks.map((track) => [track, []]));
        return this._getAnkiCards(profile).then((ankiCards) => {
            for (const ankiCard of ankiCards) {
                const arr = orphanedTrackCardIds.get(ankiCard.track);
                if (!arr) continue;
                arr.push(ankiCard.cardId);
            }
            return orphanedTrackCardIds;
        });
    }

    private async _ensureBuildId(
        key: DictionaryMetaKey,
        buildId: string,
        options?: { buildTs: number }
    ): Promise<boolean> {
        return this.db.transaction('rw', this.db.meta, async () => {
            const trackMeta = await this.db.meta.where('[profile+track]').equals(key).first();
            if (!options?.buildTs) return trackMeta?.buildId === buildId; // For health check
            const { buildTs } = options;
            const initialExpiration = buildTs + BUILD_MIN_EXPIRATION_MS; // Will be updated continuously as work is done

            // First time build for this track
            if (!trackMeta) {
                await this.db.meta.add({
                    profile: key[0],
                    track: key[1],
                    lastBuildStartedAt: buildTs,
                    lastBuildExpiresAt: initialExpiration,
                    buildId,
                    settings: null,
                });
                return true;
            }

            // Build already in progress, ensure it's not stale
            if (trackMeta.buildId && trackMeta.buildId !== buildId) {
                if (buildTs < trackMeta.lastBuildExpiresAt) return false;
                console.warn(
                    `Stale buildId ${trackMeta.buildId} which expired at ${new Date(trackMeta.lastBuildExpiresAt).toISOString()} detected for track ${key[1] + 1}, ignoring.`
                );
            }

            await this.db.meta.update(key, {
                lastBuildStartedAt: buildTs,
                lastBuildExpiresAt: initialExpiration,
                buildId,
            });
            return true;
        });
    }

    private async _buildIdHealthCheck(buildId: string, trackBuildIdsToClear: DictionaryMetaKey[]): Promise<void> {
        for (const metaKey of trackBuildIdsToClear) {
            if (await this._ensureBuildId(metaKey, buildId)) continue; // Handles deleteProfile() triggered during build as well
            throw new Error(`Aborting Anki token build for tracks, buildId was corrupted for track ${metaKey[1] + 1}`);
        }
    }

    private async _clearBuildId(key: DictionaryMetaKey, buildId: string): Promise<void> {
        return this.db.transaction('rw', this.db.meta, async () => {
            const trackMeta = await this.db.meta.where('[profile+track]').equals(key).first();
            if (trackMeta?.buildId !== buildId) return;
            await this.db.meta.update(key, { buildId: null });
        });
    }

    async buildAnkiCache(
        inputProfile: string | undefined,
        settings: AsbplayerSettings,
        statusUpdates: (state: DictionaryBuildAnkiCacheState) => void,
        options?: { extensionInstalled?: boolean }
    ): Promise<DictionaryBuildAnkiCacheState> {
        let msg = 'Unknown error querying Anki for cache';
        let error = true;
        const modifiedTokens = new Set<string>();

        const profile = this._getProfile(inputProfile);
        const buildId = uuidv4();
        const buildTs = Date.now();
        const trackBuildIdsToClear: DictionaryMetaKey[] = [];
        let clearBuildIds = true;
        try {
            // Determine which tracks are valid for building
            const trackStates: TrackStatesForDB = new Map();
            const settingsToUpdate: { key: DictionaryMetaKey; changes: { settings: string } }[] = [];
            const tracksToClear: number[] = [];
            for (const [track, dt] of settings.dictionaryTracks.entries()) {
                const key: DictionaryMetaKey = [profile, track];
                let prevSettings: string | null = null;
                const canBuild = await this.db.transaction('rw', this.db.meta, async () => {
                    if (await this._ensureBuildId(key, buildId, { buildTs })) {
                        prevSettings = (await this.db.meta.get(key))!.settings;
                        return true;
                    }
                    const expiration = await this.db.meta
                        .where('[profile+track]')
                        .equals(key)
                        .first()
                        .then((meta) =>
                            new Date(meta!.lastBuildExpiresAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                            })
                        );
                    msg = `Skipping Anki cache build for tracks, already in progress for track ${track + 1} (build will expire at ${expiration})`;
                    console.error(msg);
                    return false;
                });
                if (!canBuild) return { command, msg, error, modifiedTokens: Array.from(modifiedTokens) }; // Since we set the buildId for all tracks regardless of enabled status, concurrent builds are prevented
                trackBuildIdsToClear.push(key);

                if (!dictionaryStatusEnabled(dt)) continue; // Keep cache but don't update it TODO: Clear tracks that have been disabled for a while from db?
                if (!dt.dictionaryAnkiWordFields.length && !dt.dictionaryAnkiSentenceFields.length) {
                    tracksToClear.push(track); // Explicitly clear tracks with no Anki fields
                    continue;
                }
                const yomitan = new Yomitan(dt);
                try {
                    await yomitan.version();
                } catch (e) {
                    msg = `Skipping Anki cache build for tracks, could not connect to Yomitan for track ${track + 1} (disable this track to skip): ${e}`;
                    console.error(msg);
                    return { command, msg, error, modifiedTokens: Array.from(modifiedTokens) };
                }
                trackStates.set(track, { dt, yomitan });

                const currSettings: AnkiCacheSettingsDependencies = {
                    ankiConnectUrl: settings.ankiConnectUrl,
                    dictionaryYomitanUrl: dt.dictionaryYomitanUrl,
                    dictionaryYomitanScanLength: dt.dictionaryYomitanScanLength,
                    dictionaryAnkiWordFields: dt.dictionaryAnkiWordFields,
                    dictionaryAnkiSentenceFields: dt.dictionaryAnkiSentenceFields,
                    dictionaryAnkiMatureCutoff: dt.dictionaryAnkiMatureCutoff,
                };
                const currSettingsStr = JSON.stringify(currSettings);
                if (currSettingsStr === prevSettings) continue;
                settingsToUpdate.push({ key, changes: { settings: currSettingsStr } });
                tracksToClear.push(track); // Clear track if settings have changed
            }

            let numCardsFromOrphanedTracks = 0;
            if (tracksToClear.length) {
                const orphanedTrackCardIds = await this._orphanAllCardIds(profile, tracksToClear);
                numCardsFromOrphanedTracks = Array.from(orphanedTrackCardIds.values()).reduce(
                    (a, b) => a + b.length,
                    0
                );
                await this.db.transaction('rw', this.db.tokens, this.db.ankiCards, this.db.meta, async () => {
                    await this._buildIdHealthCheck(buildId, trackBuildIdsToClear);
                    await this._deleteCardBulk(profile, orphanedTrackCardIds, modifiedTokens);
                    await this._gatherModifiedTokens(profile, modifiedTokens);
                    if (settingsToUpdate.length) await this.db.meta.bulkUpdate(settingsToUpdate); // Set the new settings so we can resume the build if it fails midway
                });
                if (!trackStates.size) {
                    msg = `Cleared ${numCardsFromOrphanedTracks.toLocaleString('en-US')} card(s) from enabled tracks with no Anki fields: ${tracksToClear.map((track) => `Track ${track + 1}`).join(', ')}`;
                    error = false;
                    return { command, msg, error, modifiedTokens: Array.from(modifiedTokens) };
                }
            } else if (!trackStates.size) {
                msg = `No enabled tracks with Anki fields for cache build`;
                return { command, msg, error, modifiedTokens: Array.from(modifiedTokens) };
            }

            const anki = new Anki(settings);
            try {
                const permission = (await anki.requestPermission()).permission;
                if (permission !== 'granted') throw new Error(`permission ${permission}`);
            } catch (e) {
                msg = `Skipping Anki cache build for tracks, could not get Anki permission: ${e}`;
                console.error(msg);
                return { command, msg, error, modifiedTokens: Array.from(modifiedTokens) };
            }

            const modifiedCards: CardsForDB = new Map();
            const cardIdsToSuspend: number[] = [];
            const cardIdsToUnsuspend: number[] = [];
            const orphanedTrackCardIds: Map<number, number[]> = new Map();
            let numUpdatedCards = 0;
            try {
                numUpdatedCards = await this._syncTrackStatesWithAnki(
                    profile,
                    trackStates,
                    modifiedCards,
                    cardIdsToSuspend,
                    cardIdsToUnsuspend,
                    orphanedTrackCardIds,
                    anki
                );
                for (const [track, ts] of trackStates.entries()) {
                    await this._buildAnkiCardStatuses(track, ts, modifiedCards, anki);
                }
            } catch (e) {
                msg = `Skipping Anki cache build for tracks, could not sync track states with Anki: ${e}`;
                console.error(msg);
                return { command, msg, error, modifiedTokens: Array.from(modifiedTokens) };
            }

            // Usually less than 5s to this point, building the tokens may take a while and is unlikely to fail
            void this._processTracks(
                profile,
                buildId,
                trackStates,
                modifiedCards,
                cardIdsToSuspend,
                cardIdsToUnsuspend,
                orphanedTrackCardIds,
                tracksToClear,
                numCardsFromOrphanedTracks,
                modifiedTokens,
                trackBuildIdsToClear,
                numUpdatedCards,
                buildTs,
                statusUpdates,
                options
            );
            if (numUpdatedCards) {
                msg = `Building Anki cache${options?.extensionInstalled ? '' : ' (keep tab open)'}: ${numUpdatedCards.toLocaleString('en-US')} modified card(s) across ${trackStates.size} track(s)`;
            } else {
                msg = `No Anki cards were modified since the last build for any of the ${trackStates.size} track(s)`;
            }
            error = false;
            clearBuildIds = false;
        } catch (e) {
            msg = `Error during Anki cache build for tracks: ${e}`;
            console.error(msg);
        } finally {
            if (clearBuildIds) await this._clearBuildIds(trackBuildIdsToClear, buildId); // Otherwise let _processTracks() clear the build IDs when it's done
        }
        try {
            statusUpdates({ command, msg, error, modifiedTokens: Array.from(modifiedTokens) });
        } catch (e) {
            console.error(`Error sending status update for Anki cache build: ${e}`);
        }
        return { command, msg, error, modifiedTokens: Array.from(modifiedTokens) };
    }

    private async _clearBuildIds(trackBuildIdsToClear: DictionaryMetaKey[], buildId: string): Promise<void> {
        for (const key of trackBuildIdsToClear) {
            try {
                await this._clearBuildId(key, buildId);
            } catch (e) {
                console.error(`Error clearing Anki token build ID for track ${key[1] + 1}: ${e}`);
            }
        }
    }

    private async _syncTrackStatesWithAnki(
        profile: string,
        trackStates: TrackStatesForDB,
        modifiedCards: CardsForDB,
        cardIdsToSuspend: number[],
        cardIdsToUnsuspend: number[],
        orphanedTrackCardIds: Map<number, number[]>,
        anki: Anki
    ): Promise<number> {
        const allFieldsQuery = Array.from(
            new Set(
                Array.from(trackStates.values()).flatMap((ts) => [
                    ...ts.dt.dictionaryAnkiWordFields,
                    ...ts.dt.dictionaryAnkiSentenceFields,
                ])
            )
        )
            .map((field) => `"${field}:_*"`)
            .join(' OR ');
        const noteIds = await anki.findNotes(allFieldsQuery);
        if (!noteIds.length) {
            for (const [k, v] of (await this._orphanAllCardIds(profile, Array.from(trackStates.keys()))).entries()) {
                orphanedTrackCardIds.set(k, v);
            }
            return new Set(Array.from(orphanedTrackCardIds.values()).flat()).size;
        }

        const notesInfo = await anki.notesInfo(noteIds);
        if (notesInfo.length !== noteIds.length) {
            throw new Error('Anki changed during cards record build, some notes info could not be retrieved.');
        }
        const notesModTime = (await anki.notesModTime(noteIds)).reduce((acc, cur) => {
            acc.set(cur.noteId, cur.mod);
            return acc;
        }, new Map<number, number>()); // Edits to the fields are reflected in note mod time
        if (notesModTime.size !== noteIds.length) {
            throw new Error('Anki changed during cards record build, some notes mod time could not be retrieved.');
        }
        const allCardIds = notesInfo.flatMap((noteInfo) => noteInfo.cards);
        const cardsModTime = (await anki.cardsModTime(allCardIds)).reduce((acc, cur) => {
            acc.set(cur.cardId, cur.mod);
            return acc;
        }, new Map<number, number>()); // Reviews or suspension status are reflected in card mod time
        if (cardsModTime.size !== allCardIds.length) {
            throw new Error('Anki changed during cards record build, some cards mod time could not be retrieved.');
        }

        const existingAnkiNoteIdMap = await this._getAnkiCardsByNoteIdBulk(profile, noteIds);
        const modifiedNotes: NoteInfo[] = [];
        const modifiedCardIdsSet = new Set<number>();
        for (const noteInfo of notesInfo) {
            if (!Object.keys(noteInfo.fields).length || !noteInfo.cards.length) continue;
            const noteId = noteInfo.noteId;
            const modifiedAt = Math.max(
                notesModTime.get(noteId)!,
                ...noteInfo.cards.map((cardId) => cardsModTime.get(cardId)!)
            );
            const existingAnkiCards = existingAnkiNoteIdMap.get(noteId);
            if (
                existingAnkiCards?.length === noteInfo.cards.length &&
                noteInfo.cards.every((cardId) => existingAnkiCards.some((ankiCard) => ankiCard.cardId === cardId)) &&
                existingAnkiCards.every((ankiCard) => ankiCard.modifiedAt === modifiedAt)
            ) {
                continue;
            }
            noteInfo.mod = modifiedAt;
            modifiedNotes.push(noteInfo);
            for (const cardId of noteInfo.cards) modifiedCardIdsSet.add(cardId);
        }

        if (modifiedNotes.length) {
            const modifiedCardIds = Array.from(modifiedCardIdsSet);
            const suspendedCards = new Set<number>();
            const areSuspended = await anki.areSuspended(modifiedCardIds);
            for (let i = 0; i < modifiedCardIds.length; i++) {
                if (areSuspended[i]) suspendedCards.add(modifiedCardIds[i]);
            }

            for (const modifiedNote of modifiedNotes) {
                const fields = new Map<string, string>();
                for (const [fieldName, { value }] of Object.entries(modifiedNote.fields)) {
                    const trimmedValue = value.trim();
                    if (!trimmedValue.length) continue;
                    fields.set(fieldName, trimmedValue);
                }
                for (const cardId of modifiedNote.cards) {
                    modifiedCards.set(cardId, {
                        noteId: modifiedNote.noteId,
                        fields,
                        modifiedAt: modifiedNote.mod,
                        statuses: new Map(),
                        suspended: suspendedCards.has(cardId),
                    });
                }
            }

            for (const existingAnkiCards of existingAnkiNoteIdMap.values()) {
                for (const ankiCard of existingAnkiCards) {
                    if (!modifiedCardIdsSet.has(ankiCard.cardId)) continue;
                    if (suspendedCards.has(ankiCard.cardId)) {
                        if (!ankiCard.suspended) cardIdsToSuspend.push(ankiCard.cardId);
                    } else {
                        if (ankiCard.suspended) cardIdsToUnsuspend.push(ankiCard.cardId);
                    }
                }
            }
        }

        let numUpdatedCards = modifiedCardIdsSet.size;
        for (const track of trackStates.keys()) orphanedTrackCardIds.set(track, []);
        for (const ankiCard of await this._getAnkiCards(profile)) {
            const { track, cardId } = ankiCard;
            const ts = trackStates.get(track);
            if (!ts) continue;
            if (!cardsModTime.has(cardId)) {
                orphanedTrackCardIds.get(track)!.push(cardId); // Card was removed from Anki
                numUpdatedCards += 1; // Only need to count these as modified cards are already counted
                continue;
            }
            if (!modifiedCardIdsSet.has(cardId)) continue; // Card unchanged
            const modifiedCard = modifiedCards.get(cardId)!;
            const hasWordField = ts.dt.dictionaryAnkiWordFields.some((f) => modifiedCard.fields.has(f));
            const hasSentenceField = ts.dt.dictionaryAnkiSentenceFields.some((f) => modifiedCard.fields.has(f));
            if (!hasWordField && !hasSentenceField) orphanedTrackCardIds.get(track)!.push(cardId); // Card no longer has any relevant fields
        }

        return numUpdatedCards;
    }

    private async _buildAnkiCardStatuses(
        track: number,
        ts: TrackStateForDB,
        modifiedCards: CardsForDB,
        anki: Anki
    ): Promise<void> {
        if (!modifiedCards.size) return;
        const ankiFields = Array.from(
            new Set([...ts.dt.dictionaryAnkiWordFields, ...ts.dt.dictionaryAnkiSentenceFields])
        );
        if (!ankiFields.length) return;
        const fields = ankiFields.map((field) => `"${field}:_*"`).join(' OR ');
        const matureCutoff = ts.dt.dictionaryAnkiMatureCutoff;
        const gradCutoff = Math.ceil(matureCutoff / 2);
        let numRemaining = Array.from(modifiedCards.values()).filter((card) =>
            ankiFields.some((ankiField) => card.fields.has(ankiField))
        ).length;

        numRemaining = this._processAnkiCardStatuses(
            track,
            await anki.findCards(`is:new (${fields})`),
            modifiedCards,
            TokenStatus.UNKNOWN,
            numRemaining
        );
        if (numRemaining === 0) return;
        numRemaining = this._processAnkiCardStatuses(
            track,
            await anki.findCards(`is:learn (${fields})`),
            modifiedCards,
            TokenStatus.LEARNING,
            numRemaining
        );
        if (numRemaining === 0) return;

        // AnkiConnect doesn't expose Stability but we can retrieve it using search queries.
        // Stability is undefined for cards reviewed without FSRS so some cards may need to fallback to Interval.
        const props = ['prop:s', 'prop:ivl'];
        const startIndex = (await anki.findCards(`prop:s>=0 (${fields})`)).length ? 0 : 1; // No cards are returned if FSRS is disabled
        for (let i = startIndex; i < props.length; i++) {
            const prop = props[i];
            numRemaining = this._processAnkiCardStatuses(
                track,
                await anki.findCards(`-is:new -is:learn ${prop}<${gradCutoff} (${fields})`),
                modifiedCards,
                TokenStatus.GRADUATED,
                numRemaining
            );
            if (numRemaining === 0) return;
            numRemaining = this._processAnkiCardStatuses(
                track,
                await anki.findCards(`-is:new -is:learn ${prop}>=${gradCutoff} ${prop}<${matureCutoff} (${fields})`),
                modifiedCards,
                TokenStatus.YOUNG,
                numRemaining
            );
            if (numRemaining === 0) return;
            numRemaining = this._processAnkiCardStatuses(
                track,
                await anki.findCards(`-is:new -is:learn ${prop}>=${matureCutoff} (${fields})`),
                modifiedCards,
                TokenStatus.MATURE,
                numRemaining
            );
            if (numRemaining === 0) return;
        }
        if (numRemaining !== 0) {
            throw new Error('Anki changed during status build, some cards statuses could not be determined.');
        }
    }

    private _processAnkiCardStatuses(
        track: number,
        cardIds: number[],
        modifiedCards: CardsForDB,
        status: TokenStatus,
        numRemaining: number
    ): number {
        for (const cardId of cardIds) {
            const updatedCard = modifiedCards.get(cardId);
            if (!updatedCard || updatedCard.statuses.has(track)) continue;
            updatedCard.statuses.set(track, status);
            if (--numRemaining === 0) break;
        }
        return numRemaining;
    }

    private async _updateSuspendedCards(
        profile: string,
        trackSuspensions: Map<number, { cardIdsToSuspend: number[]; cardIdsToUnsuspend: number[] }>,
        modifiedTokens: Set<string>
    ): Promise<number> {
        const keysAndChanges: { key: DictionaryAnkiCardKey; changes: Partial<DictionaryAnkiCardRecord> }[] = [];
        const allCardIdsSet = new Set<number>();
        for (const [track, { cardIdsToSuspend, cardIdsToUnsuspend }] of trackSuspensions.entries()) {
            for (const cardId of cardIdsToSuspend) {
                keysAndChanges.push({ key: [cardId, track, profile], changes: { suspended: true } });
                allCardIdsSet.add(cardId);
            }
            for (const cardId of cardIdsToUnsuspend) {
                keysAndChanges.push({ key: [cardId, track, profile], changes: { suspended: false } });
                allCardIdsSet.add(cardId);
            }
        }
        if (!keysAndChanges.length) return 0;

        return this.db
            .transaction('rw', this.db.tokens, this.db.ankiCards, async () =>
                Promise.all([
                    this.db.tokens
                        .where('cardIds')
                        .anyOf(Array.from(allCardIdsSet))
                        .distinct()
                        .filter((r) => r.profile === profile)
                        .toArray()
                        .then((records) => {
                            for (const record of records) {
                                modifiedTokens.add(record.token);
                                for (const lemma of record.lemmas) modifiedTokens.add(lemma);
                            }
                        }),
                    this.db.ankiCards.bulkUpdate(keysAndChanges),
                ])
            )
            .then((res) => res[1]);
    }

    private async _updateBuildAnkiCacheProgress(
        buildId: string,
        trackBuildIdsToClear: DictionaryMetaKey[],
        progress: BuildAnkiCacheProgress,
        statusUpdates: (state: DictionaryBuildAnkiCacheState) => void,
        options?: { extensionInstalled?: boolean }
    ): Promise<void> {
        const rate = progress.current / (Date.now() - progress.startedAt);
        const eta = rate ? Math.ceil((progress.total - progress.current) / rate) : 0;
        await this.db.transaction('rw', this.db.meta, async () => {
            await this._buildIdHealthCheck(buildId, trackBuildIdsToClear);
            const lastBuildExpiresAt = Date.now() + Math.max(eta, BUILD_MIN_EXPIRATION_MS);
            const keysAndChanges: { key: DictionaryMetaKey; changes: { lastBuildExpiresAt: number } }[] = [];
            for (const key of trackBuildIdsToClear) keysAndChanges.push({ key, changes: { lastBuildExpiresAt } });
            await this.db.meta.bulkUpdate(keysAndChanges);
        });
        const time = new Date(Date.now() + eta).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
        let etaSeconds = Math.ceil(eta / 1000);
        const etaHours = Math.floor(etaSeconds / 3600);
        etaSeconds -= etaHours * 3600;
        const etaMinutes = Math.floor(etaSeconds / 60);
        etaSeconds -= etaMinutes * 60;
        let etaStr = '';
        if (etaHours) etaStr += `${etaHours}h`;
        if (etaMinutes) etaStr += `${etaMinutes}m`;
        etaStr += `${etaSeconds}s`;
        const msg = `Building Anki cache${options?.extensionInstalled ? '' : ' (keep tab open)'}: ${progress.current.toLocaleString('en-US')} / ${progress.total.toLocaleString('en-US')} cards processed [ETA: ${time} (${etaStr})]`;
        statusUpdates({ command, msg, error: false, modifiedTokens: [] });
    }

    private async _processTracks(
        profile: string,
        buildId: string,
        trackStates: Map<number, TrackStateForDB>,
        modifiedCards: CardsForDB,
        cardIdsToSuspend: number[],
        cardIdsToUnsuspend: number[],
        orphanedTrackCardIds: Map<number, number[]>,
        tracksToClear: number[],
        numCardsFromOrphanedTracks: number,
        modifiedTokens: Set<string>,
        trackBuildIdsToClear: DictionaryMetaKey[],
        numUpdatedCards: number,
        buildTs: number,
        statusUpdates: (state: DictionaryBuildAnkiCacheState) => void,
        options?: { extensionInstalled?: boolean }
    ): Promise<void> {
        let msg = 'Unknown error during Anki cache build for tracks';
        let error = true;
        let numSuspendedModified = 0;
        const progress: BuildAnkiCacheProgress = {
            current: 0,
            total: numUpdatedCards,
            startedAt: Date.now(),
        };
        try {
            const trackSuspensions = new Map<number, { cardIdsToSuspend: number[]; cardIdsToUnsuspend: number[] }>();
            for (const t of trackStates.keys()) trackSuspensions.set(t, { cardIdsToSuspend, cardIdsToUnsuspend });

            // Need to update these first in case the build fails after updating some cards and their modified time
            await this.db.transaction('rw', this.db.meta, this.db.tokens, this.db.ankiCards, async () => {
                await this._buildIdHealthCheck(buildId, trackBuildIdsToClear);
                numSuspendedModified = await this._updateSuspendedCards(profile, trackSuspensions, modifiedTokens);
                await this._deleteCardBulk(profile, orphanedTrackCardIds, modifiedTokens);
            });

            // Cannot perform this in the transaction above as there are external async calls in here
            await this._buildTokensForTracks(
                profile,
                trackStates,
                modifiedCards,
                buildId,
                modifiedTokens,
                trackBuildIdsToClear,
                progress,
                statusUpdates,
                options
            );

            const duration = Math.ceil((Date.now() - buildTs) / 1000);
            const base = `Built Anki cache in ${duration.toLocaleString('en-US')}s for`;
            const modified = `${numUpdatedCards.toLocaleString('en-US')} modified card(s)`;
            const suspended = `${numSuspendedModified.toLocaleString('en-US')} suspended status change(s)`;
            const orphaned = tracksToClear.length
                ? ` (deleted ${numCardsFromOrphanedTracks.toLocaleString('en-US')} card(s) from orphaned tracks: ${tracksToClear.map((t) => `Track ${t + 1}`).join(', ')})`
                : '';
            msg = `${base} ${modified} with ${suspended} across ${trackStates.size} track(s)${orphaned}`;
            error = false;
        } catch (e) {
            msg = `Error during Anki cache build for tracks: ${e}`;
            console.error(msg);
        } finally {
            await this._clearBuildIds(trackBuildIdsToClear, buildId);
        }
        try {
            if (modifiedTokens.size || numUpdatedCards || numSuspendedModified || numCardsFromOrphanedTracks || error) {
                await this._gatherModifiedTokens(profile, modifiedTokens);
                statusUpdates({ command, msg, error, modifiedTokens: Array.from(modifiedTokens) });
            }
        } catch (e) {
            console.error(`Error sending status update: ${e}`);
        }
    }

    private async _buildTokensForTracks(
        profile: string,
        trackStates: Map<number, TrackStateForDB>,
        modifiedCards: CardsForDB,
        buildId: string,
        modifiedTokens: Set<string>,
        trackBuildIdsToClear: DictionaryMetaKey[],
        progress: BuildAnkiCacheProgress,
        statusUpdates: (state: DictionaryBuildAnkiCacheState) => void,
        options?: { extensionInstalled?: boolean }
    ): Promise<void> {
        if (!modifiedCards.size) return;
        const ankiTokenStatus = null; // Calculate when getting due to certain settings (e.g. dictionaryAnkiMatureCutoff dictionaryAnkiTreatSuspended)

        await inBatches(
            Array.from(modifiedCards.entries()),
            async (b) => {
                const modifiedCardsBatch: CardsForDB = new Map();
                for (const [cardId, card] of b) modifiedCardsBatch.set(cardId, card);

                for (const ts of trackStates.values()) {
                    const texts: string[] = [];
                    const ankiFields = new Set([
                        ...ts.dt.dictionaryAnkiWordFields,
                        ...ts.dt.dictionaryAnkiSentenceFields,
                    ]);
                    for (const card of modifiedCardsBatch.values()) {
                        for (const ankiField of ankiFields) {
                            const field = card.fields.get(ankiField);
                            if (field) texts.push(field);
                        }
                    }
                    await ts.yomitan.tokenizeBulk(texts);
                }

                const trackTokensMap = new Map<
                    number,
                    Map<DictionaryTokenSource, Map<string, { lemmas: string[]; cardIds: Set<number> }>>
                >();
                const ankiFieldsMap = new Map<number, Map<DictionaryTokenSource, string[]>>();
                for (const [track, ts] of trackStates.entries()) {
                    trackTokensMap.set(
                        track,
                        new Map([
                            [DictionaryTokenSource.ANKI_WORD, new Map()],
                            [DictionaryTokenSource.ANKI_SENTENCE, new Map()],
                        ])
                    );
                    ankiFieldsMap.set(
                        track,
                        new Map([
                            [DictionaryTokenSource.ANKI_WORD, ts.dt.dictionaryAnkiWordFields],
                            [DictionaryTokenSource.ANKI_SENTENCE, ts.dt.dictionaryAnkiSentenceFields],
                        ])
                    );
                }
                for (const [track, ts] of trackStates.entries()) {
                    const sourceTokensMap = trackTokensMap.get(track)!;
                    const sourceAnkiFieldsMap = ankiFieldsMap.get(track)!;
                    for (const [source, ankiFields] of sourceAnkiFieldsMap.entries()) {
                        for (const ankiField of ankiFields) {
                            const tokenCardsMap = sourceTokensMap.get(source)!;
                            for (const [cardId, card] of modifiedCardsBatch.entries()) {
                                const field = card.fields.get(ankiField);
                                if (!field) continue;
                                for (const tokenParts of await ts.yomitan.tokenize(field)) {
                                    const trimmedToken = tokenParts
                                        .map((p) => p.text)
                                        .join('')
                                        .trim();
                                    if (!HAS_LETTER_REGEX.test(trimmedToken)) continue;
                                    let val = tokenCardsMap.get(trimmedToken);
                                    if (!val) {
                                        val = {
                                            lemmas: await ts.yomitan.lemmatize(trimmedToken),
                                            cardIds: new Set<number>(),
                                        };
                                        tokenCardsMap.set(trimmedToken, val);
                                    }
                                    val.cardIds.add(cardId);
                                }
                            }
                        }
                    }
                    ts.yomitan.resetCache();
                }

                const records: DictionaryTokenRecord[] = [];
                const ankiCards: DictionaryAnkiCardRecord[] = [];
                for (const track of trackStates.keys()) {
                    for (const [source, tokenCardsMap] of trackTokensMap.get(track)!.entries()) {
                        const tokenRecordMap = await this._getFromSourceBulk(
                            profile,
                            track,
                            source,
                            Array.from(tokenCardsMap.keys())
                        );
                        for (const [token, val] of tokenCardsMap.entries()) {
                            const existingRecords = tokenRecordMap.get(token) || []; // Merge with existing records
                            const states: DictionaryTokenState[] = [];
                            for (const existingRecord of existingRecords) {
                                for (const cardId of existingRecord.cardIds) {
                                    if (!modifiedCardsBatch.has(cardId)) val.cardIds.add(cardId); // If card was updated, it may no longer apply to this token. Should already be in cardIds if it's still valid.
                                }
                                for (const state of existingRecord.states) {
                                    if (!states.includes(state)) states.push(state);
                                }
                            }
                            records.push({
                                profile,
                                track,
                                source,
                                token,
                                status: ankiTokenStatus,
                                lemmas: val.lemmas,
                                states,
                                cardIds: Array.from(val.cardIds),
                            });
                        }
                    }
                    for (const [cardId, updatedCard] of modifiedCardsBatch.entries()) {
                        const status = updatedCard.statuses.get(track);
                        if (status === undefined) continue; // Card has no relevant fields for this track
                        ankiCards.push({
                            profile,
                            track,
                            cardId: cardId,
                            noteId: updatedCard.noteId,
                            modifiedAt: updatedCard.modifiedAt,
                            status,
                            suspended: updatedCard.suspended,
                        });
                    }
                }

                await this.db.transaction('rw', this.db.meta, this.db.tokens, this.db.ankiCards, async () => {
                    await this._buildIdHealthCheck(buildId, trackBuildIdsToClear);
                    await this._saveTokensForDB(
                        profile,
                        trackStates,
                        records,
                        ankiCards,
                        modifiedCardsBatch,
                        trackTokensMap,
                        modifiedTokens
                    );
                });

                progress.current += modifiedCardsBatch.size;
                await this._updateBuildAnkiCacheProgress(
                    buildId,
                    trackBuildIdsToClear,
                    progress,
                    statusUpdates,
                    options
                );
            },
            { batchSize: 100 } // Batch for memory usage and yomitan cache size
        );
    }

    private async _saveTokensForDB(
        profile: string,
        trackStates: Map<number, TrackStateForDB>,
        records: DictionaryTokenRecord[],
        ankiCards: DictionaryAnkiCardRecord[],
        modifiedCardsBatch: CardsForDB,
        trackTokensMap: Map<
            number,
            Map<DictionaryTokenSource, Map<string, { lemmas: string[]; cardIds: Set<number> }>>
        >,
        modifiedTokens: Set<string>
    ): Promise<void> {
        for (const record of records) {
            modifiedTokens.add(record.token);
            for (const lemma of record.lemmas) modifiedTokens.add(lemma);
        }
        return this.db.transaction('rw', this.db.tokens, this.db.ankiCards, async () => {
            await Promise.all([this._saveRecordBulk(records), this.db.ankiCards.bulkPut(ankiCards)]);
            await this.db.tokens
                .where('cardIds')
                .anyOf(Array.from(modifiedCardsBatch.keys()))
                .distinct()
                .filter((r) => r.profile === profile)
                .modify((record, ref) => {
                    if (
                        record.source !== DictionaryTokenSource.ANKI_WORD &&
                        record.source !== DictionaryTokenSource.ANKI_SENTENCE
                    ) {
                        return;
                    }
                    if (!trackStates.has(record.track)) return;
                    if (trackTokensMap.get(record.track)!.get(record.source)!.has(record.token)) return; // We want tokens that were not updated but refers to updated cards (e.g. field value changed, different tokens)
                    const validCardIds = record.cardIds.filter((id) => !modifiedCardsBatch.has(id));
                    if (!validCardIds.length) {
                        modifiedTokens.add(record.token);
                        for (const lemma of record.lemmas) modifiedTokens.add(lemma);
                        delete (ref as any).value;
                    } else if (validCardIds.length !== record.cardIds.length) {
                        modifiedTokens.add(record.token);
                        for (const lemma of record.lemmas) modifiedTokens.add(lemma);
                        record.cardIds = validCardIds;
                    }
                });
        });
    }

    private async _gatherModifiedTokens(profile: string, modifiedTokens: Set<string>) {
        if (!modifiedTokens.size) return;
        return this.db.tokens
            .where('lemmas')
            .anyOf(Array.from(modifiedTokens))
            .distinct()
            .filter((r) => r.profile === profile)
            .toArray()
            .then((records) => {
                for (const record of records) {
                    modifiedTokens.add(record.token);
                    for (const lemma of record.lemmas) modifiedTokens.add(lemma);
                }
            });
    }
}
