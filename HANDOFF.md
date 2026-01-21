# Word Learning Feature - Handoff Document

## Overview

This document describes the "Language Reactor-like" word learning feature added to asbplayer for learning Russian from YouTube videos.

## Features Implemented

### 1. Word Click Mode
- **Setting**: `wordClickEnabled` in Settings → Misc → Word Learning (LLM)
- When enabled, subtitles are tokenized into individual clickable words
- Each word is wrapped in `<span class="asbplayer-word" data-word="..." data-sentence="...">`

### 2. Hover Translation (LLM)
- Hover over a word → LLM translates the word in context
- Tooltip appears only after translation is ready (no loading state)
- Translations are cached in memory to avoid repeated API calls
- Uses Floating UI (`@floating-ui/dom`) for tooltip positioning with auto-flip/shift
- Tooltip is automatically hidden when video resumes playing

### 3. Right-Click to Save
- Right-click on a word → saves word + sentence + translation to IndexedDB
- Shows "Saved: [word]" notification briefly

### 4. Drag Selection for Chunks
- Click and drag across multiple words to select a chunk
- Yellow highlight overlay covers the entire selection
- Selection overlay is positioned inside the subtitle container (scrolls with subtitles)
- Right-click on selection → saves the entire chunk
- Hovering over any word in the selection shows translation for the whole phrase
- Tooltip anchors to the last word of the selection for better readability

### 5. Export/Clear Saved Words
- Extension popup shows saved words count when word click mode is enabled
- "Export CSV" button downloads all saved words
- CSV columns: `word`, `sentence`, `timestamp`, `videoTitle`, `videoId`
- "Clear All" button deletes all saved words (with confirmation)

## Key Files Modified/Created

### New Files
| File | Purpose |
|------|---------|
| `common/saved-words/saved-words-repository.ts` | Dexie database for saved words |
| `common/saved-words/index.ts` | Export barrel |
| `extension/src/handlers/llm/llm-translate-handler.ts` | LLM API calls with caching |
| `extension/src/handlers/saved-words/save-word-handler.ts` | Save word to DB |
| `extension/src/handlers/saved-words/get-saved-words-count-handler.ts` | Get count |
| `extension/src/handlers/saved-words/export-saved-words-handler.ts` | CSV export |
| `extension/src/handlers/saved-words/clear-saved-words-handler.ts` | Clear all |
| `extension/src/services/word-tokenizer.ts` | Russian text tokenization |
| `extension/src/controllers/word-interaction-controller.ts` | All word interaction logic |

### Modified Files
| File | Changes |
|------|---------|
| `common/src/message.ts` | Added message types for LLM translate, save word, export, clear |
| `common/settings/settings.ts` | Added `LLMSettings` interface |
| `common/settings/settings-provider.ts` | Added default LLM settings |
| `common/components/MiscSettingsTab.tsx` | Added Word Learning settings UI |
| `extension/src/controllers/subtitle-controller.ts` | Tokenize words when enabled |
| `extension/src/services/binding.ts` | Instantiate WordInteractionController |
| `extension/src/entrypoints/background.ts` | Register new handlers |
| `extension/src/entrypoints/video.content/video.css` | Word/tooltip/overlay styles |
| `extension/src/ui/components/Popup.tsx` | Saved words UI in popup |

## Settings Added

```typescript
interface LLMSettings {
    llmEnabled: boolean;           // Enable LLM translations
    llmApiKey: string;             // Anthropic API key
    llmApiEndpoint: string;        // Default: 'https://api.anthropic.com/v1/messages'
    llmModel: string;              // Default: 'claude-haiku-4-5'
    wordClickEnabled: boolean;     // Enable word click mode
}
```

The LLM handler auto-detects Anthropic vs OpenAI endpoints and uses the appropriate authentication headers.

## Data Model

```typescript
interface SavedWord {
    id: string;           // UUID
    word: string;         // The word or chunk
    sentence: string;     // The full subtitle text
    translation: string;  // LLM-provided translation
    timestamp: number;    // When saved
    videoTitle?: string;  // YouTube video title
    videoUrl?: string;    // YouTube URL (stored as full URL, exported as video ID)
}
```

## Implementation Notes

### Selection Overlay Positioning
The selection overlay uses `position: absolute` inside the subtitle container (`.asbplayer-subtitles` or `.asbplayer-fullscreen-subtitles`) rather than `position: fixed` on `document.body`. This ensures the overlay scrolls with the video and is automatically cleaned up when subtitles change.

### Tooltip Lifecycle
- Tooltip only appears after translation is fetched (no loading spinner)
- Multiple checks prevent showing stale tooltips:
  - Video must be paused (pause-on-hover mode)
  - Word element must still be connected to DOM
- Tooltip is hidden via:
  - `mouseLeave` event on the word element
  - `mousemove` detecting mouse left the word (backup for unreliable mouseLeave)
  - Video `playing` event (when video resumes)
  - `timeupdate` stale UI check

### Chunk Selection
- When multiple words are selected, the tooltip anchors to the last word
- Tooltip stays visible when moving between words in the selection
- Selection is cleared when video resumes playing

## Dependencies Added
- `@floating-ui/dom` - for tooltip positioning

## Build Commands
```bash
yarn workspace @project/extension build  # Production build
yarn dev                                  # Development mode
```

## Testing
1. Enable "word click mode" in Settings → Misc → Word Learning
2. Configure Anthropic API key
3. Load a YouTube video with Russian subtitles via asbplayer
4. Hover over words to see translations (appears after ~1s when translation is ready)
5. Right-click to save words
6. Drag to select chunks, hover to see chunk translation
7. Check popup for export/clear functionality
