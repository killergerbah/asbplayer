/**
 * Simple word tokenizer for Russian text.
 * Splits text on whitespace and punctuation while preserving the original structure.
 */

export interface TokenizedWord {
    text: string;
    isWord: boolean; // true if it's a word, false if it's punctuation/whitespace
}

// Pattern for splitting Russian/Cyrillic text into words and non-words
// Matches: letters (including Cyrillic), apostrophes within words, hyphens within words
const WORD_PATTERN = /([а-яА-ЯёЁa-zA-Z]+(?:[-'][а-яА-ЯёЁa-zA-Z]+)*)/g;

/**
 * Tokenizes text into words and non-word segments (punctuation, spaces, etc.)
 */
export function tokenizeText(text: string): TokenizedWord[] {
    const tokens: TokenizedWord[] = [];
    let lastIndex = 0;

    // Use matchAll to find all words
    const matches = text.matchAll(WORD_PATTERN);

    for (const match of matches) {
        const matchIndex = match.index!;
        const matchText = match[0];

        // Add any non-word content before this match
        if (matchIndex > lastIndex) {
            const nonWord = text.slice(lastIndex, matchIndex);
            tokens.push({ text: nonWord, isWord: false });
        }

        // Add the word
        tokens.push({ text: matchText, isWord: true });
        lastIndex = matchIndex + matchText.length;
    }

    // Add any remaining non-word content after the last match
    if (lastIndex < text.length) {
        tokens.push({ text: text.slice(lastIndex), isWord: false });
    }

    return tokens;
}

/**
 * Wraps each word in a span element with data attributes for interaction.
 * Non-word segments are preserved as-is.
 */
export function tokenizeToHtml(text: string, sentenceText: string): string {
    const tokens = tokenizeText(text);

    return tokens
        .map((token) => {
            if (token.isWord) {
                // Escape HTML entities in the word
                const escapedWord = escapeHtml(token.text);
                const escapedSentence = escapeHtml(sentenceText);
                return `<span class="asbplayer-word" data-word="${escapedWord}" data-sentence="${escapedSentence}">${escapedWord}</span>`;
            } else {
                // Preserve non-word segments (spaces, punctuation)
                return escapeHtml(token.text);
            }
        })
        .join('');
}

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
