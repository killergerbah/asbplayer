import i18n from 'i18next';
import type { ExportParams } from '@project/common/anki';

export interface JitenTarget {
    wordId: number;
    readingIndex: number;
    spelling: string;
    reading: string;
    sentence?: string;
    surfaceForm?: string;
    sourceTitle?: string;
}

export interface JitenStatus {
    tier: string;
    quota: { usedBytes: number; maxBytes: number };
}

export interface JitenDeck {
    userStudyDeckId: number;
    name: string;
    deckType: number;
}

export interface JitenAttachmentResult {
    sentence: string;
    visual: string;
    audio: string;
    failed: boolean;
    sentenceId?: number;
}

export interface JitenPending {
    targets: JitenTarget[];
    deckId: number;
}

export interface JitenOutcome {
    target: JitenTarget;
    result: JitenAttachmentResult;
}

export const jitenOutcomeMessage = (outcomes: JitenOutcome[]) =>
    outcomes
        .map(
            ({ target, result }) =>
                `${target.spelling}: ${(['sentence', 'visual', 'audio'] as const)
                    .map((kind) => `${message(kind)}: ${result[kind]}`)
                    .join('; ')}`
        )
        .join('\n');

const message = (key: string, options?: Record<string, unknown>) => String(i18n.t(`jiten.${key}`, options));
export const stripJitenMarkers = (text: string) => text.replace(/\*\*/g, '');
export const jitenSurfaceForm = (target?: JitenTarget) =>
    target?.sentence?.match(/\*\*([^*]+)\*\*/)?.[1] ?? target?.surfaceForm;

export const highlightJitenWord = (text: string, target?: JitenTarget) => {
    if (/\*\*[^*]+\*\*/.test(text)) return text;
    const surface = jitenSurfaceForm(target);
    return surface && text.includes(surface) ? text.replace(surface, `**${surface}**`) : text;
};

export const jitenValidationError = (target: JitenTarget | undefined, text: string, source: string) => {
    if (!target) return message('mineInReaderFirst');
    if (!/\*\*[^*\s][^*]*\*\*/.test(text)) return message('highlightRequired');
    if (text.length > 150 || source.length > 150) return message('lengthLimit');
    return undefined;
};

export const isJitenTarget = (value: unknown): value is JitenTarget => {
    if (!value || typeof value !== 'object') return false;
    const target = value as JitenTarget;
    return (
        Number.isInteger(target.wordId) &&
        target.wordId > 0 &&
        Number.isInteger(target.readingIndex) &&
        target.readingIndex >= 0 &&
        target.readingIndex <= 255 &&
        typeof target.spelling === 'string' &&
        typeof target.reading === 'string' &&
        (target.sentence === undefined || typeof target.sentence === 'string') &&
        (target.surfaceForm === undefined || typeof target.surfaceForm === 'string') &&
        (target.sourceTitle === undefined || typeof target.sourceTitle === 'string')
    );
};

export const jitenWordUrl = (target: JitenTarget) =>
    `https://jiten.moe/vocabulary/${target.wordId}/${target.readingIndex}`;

export class JitenClient {
    private retryAt = 0;

    constructor(
        private readonly apiKey: string | undefined,
        private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis)
    ) {}

    clearRetry() {
        this.retryAt = 0;
    }

    async request<T>(path: string, method = 'GET', body?: object | FormData): Promise<T> {
        if (this.apiKey !== undefined && !this.apiKey.trim()) throw new Error(message('apiKeyRequired'));
        if (Date.now() < this.retryAt) {
            throw new Error(message('rateLimited', { seconds: Math.ceil((this.retryAt - Date.now()) / 1000) }));
        }
        const multipart = body instanceof FormData;
        const response = await this.fetcher(`https://api.jiten.moe/api${path}`, {
            method,
            headers: {
                ...(this.apiKey !== undefined ? { 'X-Api-Key': this.apiKey } : {}),
                ...(!multipart && body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
        });
        if (!response.ok) {
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                this.retryAt =
                    retryAfter && !Number.isNaN(Number(retryAfter))
                        ? Date.now() + Number(retryAfter) * 1000
                        : Date.parse(retryAfter ?? '') || Date.now() + 60_000;
                throw new Error(
                    message('rateLimited', { seconds: Math.max(1, Math.ceil((this.retryAt - Date.now()) / 1000)) })
                );
            }
            if (response.status === 401) throw new Error(message('invalidApiKey'));
            if (response.status === 403) throw new Error(message('plusRequired'));
            const text = await response.text();
            let detail = text;
            try {
                const json = JSON.parse(text);
                detail = typeof json === 'string' ? json : (json.error ?? json.message ?? text);
            } catch {
                /* Jiten also returns plain-text validation errors. */
            }
            throw new Error(detail || message('requestFailed', { status: response.status }));
        }
        return response.json();
    }

    status() {
        return this.request<JitenStatus>('/jiten-plus/status');
    }

    async decks() {
        const decks = await this.request<JitenDeck[]>('/srs/reader-study-decks', 'POST');
        return decks.filter((deck) => deck.deckType === 2);
    }

    async newWords(targets: JitenTarget[], deckId: number) {
        if (!deckId) throw new Error(message('deckRequired'));
        if (!targets.length) throw new Error(message('parseFirst'));
        const states = await this.request<{ result: number[][]; decks: number[][] }>(
            '/reader/lookup-vocabulary',
            'POST',
            { words: targets.map((target) => [target.wordId, target.readingIndex]) }
        );
        if (states.result?.length !== targets.length || states.decks?.length !== targets.length) {
            throw new Error(message('wordLookupFailed'));
        }
        return targets.filter(
            (_, index) =>
                states.result[index].length === 1 &&
                states.result[index][0] === 0 &&
                !states.decks[index].includes(deckId)
        );
    }

    async mine(target: JitenTarget, deckId: number, params: ExportParams, sentenceId?: number) {
        const error = jitenValidationError(target, params.text ?? '', params.source ?? '');
        if (error) throw new Error(error);
        const state = await this.request<{ decks: number[][] }>('/reader/lookup-vocabulary', 'POST', {
            words: [[target.wordId, target.readingIndex]],
        });
        if (!Array.isArray(state.decks?.[0])) throw new Error(message('wordLookupFailed'));
        if (!state.decks[0].includes(deckId)) {
            await this.request(`/srs/study-decks/${deckId}/words`, 'POST', {
                wordId: target.wordId,
                readingIndex: target.readingIndex,
                occurrences: 1,
            });
        }
        return this.attach(target, params, sentenceId);
    }

    async submit(targets: JitenTarget[], params: ExportParams, deckId?: number, sentenceId?: number) {
        const outcomes: JitenOutcome[] = [];
        const baseText = stripJitenMarkers(params.text ?? '');
        for (let index = 0; index < targets.length; index++) {
            const target = targets[index];
            const text =
                index === 0
                    ? params.text
                    : baseText === stripJitenMarkers(target.sentence ?? '')
                      ? target.sentence
                      : highlightJitenWord(baseText, target);
            let result: JitenAttachmentResult;
            const savedId = index === 0 ? sentenceId : undefined;
            try {
                result =
                    deckId === undefined
                        ? await this.attach(target, { ...params, text }, savedId)
                        : await this.mine(target, deckId, { ...params, text }, savedId);
            } catch (error) {
                result = {
                    sentence: error instanceof Error ? error.message : String(error),
                    visual: message('notSent'),
                    audio: message('notSent'),
                    failed: true,
                    sentenceId: savedId,
                };
            }
            outcomes.push({ target, result });
            if (result.failed) return { outcomes, remainingTargets: targets.slice(index), text };
        }
        return { outcomes, remainingTargets: [], text: params.text };
    }

    private async media(target: JitenTarget) {
        const result = await this.request<{
            items: { wordId: number; readingIndex: number; image: unknown; audio: unknown }[];
        }>('/srs/card-media/batch', 'POST', { items: [{ wordId: target.wordId, readingIndex: target.readingIndex }] });
        const item = result.items.find(
            (item) => item.wordId === target.wordId && item.readingIndex === target.readingIndex
        );
        if (!item) throw new Error(message('mediaLookupFailed'));
        return item;
    }

    async attach(target: JitenTarget, params: ExportParams, sentenceId?: number): Promise<JitenAttachmentResult> {
        const result: JitenAttachmentResult = {
            sentence: message('notSent'),
            visual: message('omitted'),
            audio: message('omitted'),
            failed: false,
            sentenceId,
        };
        const text = params.text ?? '';
        const source = params.source ?? '';
        const error = jitenValidationError(target, text, source);
        if (error) throw new Error(error);
        try {
            const path = `/user/example-sentences/${target.wordId}/${target.readingIndex}`;
            const examples =
                sentenceId === undefined && target.sentence
                    ? await this.request<{ userExampleSentenceId: number; text: string }[]>(path)
                    : [];
            const matching = examples.filter(
                (example) => stripJitenMarkers(example.text) === stripJitenMarkers(target.sentence ?? '')
            );
            const id = sentenceId ?? (matching.length === 1 ? matching[0].userExampleSentenceId : undefined);
            const saved = await this.request<{ userExampleSentenceId: number }>(
                id === undefined ? path : `/user/example-sentences/${id}`,
                id === undefined ? 'POST' : 'PUT',
                { text, source }
            );
            result.sentenceId = saved.userExampleSentenceId;
            result.sentence = message('saved');
        } catch (error) {
            result.sentence = String(error instanceof Error ? error.message : error);
            result.failed = true;
            if (params.image) result.visual = message('notSent');
            if (params.audioClip) result.audio = message('notSent');
            return result;
        }

        for (const kind of ['visual', 'audio'] as const) {
            const media = kind === 'visual' ? params.image : params.audioClip;
            if (!media) continue;
            try {
                let existing = await this.media(target);
                const slot = kind === 'visual' ? 'image' : 'audio';
                if (existing[slot]) {
                    result[kind] = message('preserved');
                    continue;
                }
                if (media.error !== undefined) throw new Error(message('captureFailed'));
                const blob = await media.blob();
                if (blob.size > 5 * 1024 * 1024) throw new Error(message('fileTooLarge'));
                // shortcut: another client can race this check; use upload-if-absent when Jiten supports it.
                existing = await this.media(target);
                if (existing[slot]) {
                    result[kind] = message('preserved');
                    continue;
                }
                const body = new FormData();
                body.append('file', blob, media.name);
                await this.request(`/srs/card-media/${target.wordId}/${target.readingIndex}`, 'POST', body);
                result[kind] = message('saved');
            } catch (error) {
                result[kind] = String(error instanceof Error ? error.message : error);
                result.failed = true;
            }
        }
        return result;
    }
}
