import type { Command, Message, LLMTranslateMessage, LLMTranslateResponse } from '@project/common';
import { SettingsProvider } from '@project/common/settings';

interface TranslationCache {
    [key: string]: string;
}

export default class LLMTranslateHandler {
    private readonly _settings: SettingsProvider;
    private readonly _cache: TranslationCache = {};

    constructor(settings: SettingsProvider) {
        this._settings = settings;
    }

    get sender() {
        return ['asbplayer-video-tab', 'asbplayerv2'];
    }

    get command() {
        return 'llm-translate';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: LLMTranslateResponse) => void) {
        const message = command.message as LLMTranslateMessage;
        const cacheKey = `${message.word}::${message.sentence}`;

        // Check cache first
        if (this._cache[cacheKey]) {
            sendResponse({ translation: this._cache[cacheKey] });
            return;
        }

        this._settings
            .get(['llmEnabled', 'llmApiKey', 'llmApiEndpoint', 'llmModel'])
            .then(async (settings) => {
                if (!settings.llmEnabled) {
                    sendResponse({ translation: '', error: 'LLM translation is disabled' });
                    return;
                }

                if (!settings.llmApiKey) {
                    sendResponse({ translation: '', error: 'LLM API key not configured' });
                    return;
                }

                try {
                    const translation = await this._callLLM(
                        message.word,
                        message.sentence,
                        settings.llmApiEndpoint,
                        settings.llmApiKey,
                        settings.llmModel,
                        message.sourceLanguage || 'Russian',
                        message.targetLanguage || 'English'
                    );

                    // Cache the result
                    this._cache[cacheKey] = translation;
                    sendResponse({ translation });
                } catch (error) {
                    sendResponse({
                        translation: '',
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            });

        return true;
    }

    private async _callLLM(
        word: string,
        sentence: string,
        endpoint: string,
        apiKey: string,
        model: string,
        sourceLanguage: string,
        targetLanguage: string
    ): Promise<string> {
        const systemPrompt = `You are a translation assistant. Translate the given word or phrase from ${sourceLanguage} to ${targetLanguage}.
Consider the context of the sentence to provide the most accurate translation.
Return ONLY the translation, nothing else. No explanations, no alternatives, no quotation marks around the translation, just the plain translation text.`;

        const userPrompt = `Word/phrase to translate: "${word}"
Context sentence: "${sentence}"

Translate the word/phrase to ${targetLanguage}:`;

        const isAnthropic = endpoint.includes('anthropic.com');

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        let body: string;

        if (isAnthropic) {
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
            headers['anthropic-dangerous-direct-browser-access'] = 'true';
            body = JSON.stringify({
                model,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
                max_tokens: 100,
            });
        } else {
            headers['Authorization'] = `Bearer ${apiKey}`;
            body = JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.3,
                max_tokens: 100,
            });
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`LLM API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Handle Anthropic-style response
        if (data.content && data.content[0]?.text) {
            return data.content[0].text.trim();
        }

        // Handle OpenAI-style response
        if (data.choices && data.choices[0]?.message?.content) {
            return data.choices[0].message.content.trim();
        }

        throw new Error('Unexpected API response format');
    }
}
