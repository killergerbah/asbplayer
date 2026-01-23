# Custom Features - Handoff Document

## Overview

This document describes custom features added to asbplayer for learning Russian from YouTube videos.

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

## Testing Word Learning
1. Enable "word click mode" in Settings → Misc → Word Learning
2. Configure Anthropic API key
3. Load a YouTube video with Russian subtitles via asbplayer
4. Hover over words to see translations (appears after ~1s when translation is ready)
5. Right-click to save words
6. Drag to select chunks, hover to see chunk translation
7. Check popup for export/clear functionality

---

# Whisper Transcript Generation Feature

## Overview

Generate high-quality subtitles for YouTube videos using OpenAI Whisper API via a custom backend server. This provides better transcription quality than YouTube's auto-generated subtitles, with proper punctuation and improved accuracy.

## Architecture

```
[Extension] → [Railway Backend] → [OpenAI Whisper API]
                    ↓
              [pytubefix]
           (download audio)
```

## Features Implemented

### 1. Custom Transcript Server (Railway)
- **Location**: `transcript-server/` directory
- FastAPI backend deployed on Railway
- Downloads YouTube audio using `pytubefix` (pure Python, no JS runtime needed)
- Transcribes using OpenAI Whisper API (`whisper-1` model)
- Handles long videos by splitting audio into 20-minute chunks
- Returns SRT format subtitles

### 2. Client-Side Caching (IndexedDB)
- Generated transcripts are cached in IndexedDB (`asbplayer-transcript-cache`)
- Cache is keyed by YouTube video ID
- Cached subtitles load instantly on subsequent visits

### 3. Auto-Load Integration
- When "Auto-load detected subtitles" is enabled:
  - Checks for cached Whisper subtitles first
  - Falls back to YouTube's auto-generated subtitles if no cache
- Cached subtitles appear in the "Select Subtitles" dropdown as "Generated (Whisper)"
- Pre-selected by default when available

### 4. Manual Generation
- "Generate Subtitles" button in the Select Subtitles dialog (YouTube only)
- Only visible when transcript server URL is configured
- Shows loading spinner during generation
- Results are cached automatically

### 5. Cache Management (Settings UI)
- Located in Settings → Misc → Subtitle Generation section
- Shows count of cached transcripts
- "Export" button downloads all cached transcripts as JSON backup
- "Clear" button deletes all cached transcripts (with confirmation)

## Key Files

### New Files (Extension)
| File | Purpose |
|------|---------|
| `extension/src/handlers/supadata/supadata-generate-handler.ts` | Calls transcript server, manages cache |
| `extension/src/handlers/video/get-cached-transcript-handler.ts` | Returns cached transcript to content script |
| `extension/src/handlers/video/export-transcript-cache-handler.ts` | Exports all cached transcripts as JSON |
| `extension/src/handlers/video/clear-transcript-cache-handler.ts` | Clears all cached transcripts |
| `extension/src/handlers/video/get-transcript-cache-count-handler.ts` | Returns count of cached transcripts |
| `extension/src/services/transcript-cache.ts` | IndexedDB cache for transcripts |

### New Files (Server)
| File | Purpose |
|------|---------|
| `transcript-server/main.py` | FastAPI server with Whisper transcription |
| `transcript-server/requirements.txt` | Python dependencies |
| `transcript-server/railway.toml` | Railway deployment config |

### Modified Files
| File | Changes |
|------|---------|
| `common/src/message.ts` | Added `SupadataGenerateMessage`, `GetCachedTranscriptMessage` types |
| `common/src/model.ts` | Added `isYouTube`, `supadataApiKeyConfigured`, `isGeneratingSupadata` to UI model |
| `common/settings/settings.ts` | Added `TranscriptSettings` interface |
| `common/settings/settings-provider.ts` | Added default transcript server URL |
| `common/components/MiscSettingsTab.tsx` | Added transcript server settings UI |
| `extension/src/controllers/video-data-sync-controller.ts` | Auto-load cached subtitles, add to dropdown |
| `extension/src/ui/components/VideoDataSyncDialog.tsx` | "Generate Subtitles" button |
| `extension/src/ui/components/VideoDataSyncUi.tsx` | State management for generation |
| `extension/src/entrypoints/background.ts` | Register new handlers |

## Settings Added

```typescript
interface TranscriptSettings {
    transcriptServerUrl: string;  // Default: 'https://asbplayer-production.up.railway.app'
    transcriptApiKey: string;     // Optional API key for server auth
}
```

## Server Environment Variables

```bash
OPENAI_API_KEY=sk-...          # Required: OpenAI API key for Whisper
TRANSCRIPT_API_KEY=...          # Optional: API key to protect the endpoint
```

## Data Model (Cache)

```typescript
interface CachedTranscript {
    videoId: string;    // YouTube video ID (extracted from URL)
    srt: string;        // Full SRT content
    createdAt: number;  // Timestamp when cached
}
```

## Server Dependencies

```
fastapi>=0.109.0
uvicorn>=0.27.0
openai>=1.12.0
pydantic>=2.0.0
pytubefix>=8.0.0
pydub>=0.25.0
static-ffmpeg>=2.5
```

## Deployment

The server is deployed on Railway with Railpack builder:

```toml
[build]
builder = "railpack"
buildCommand = "pip install -r requirements.txt"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
```

## Testing Transcript Generation
1. Configure transcript server URL in Settings → Misc → Subtitle Generation
2. Go to a YouTube video
3. Click "Load Subtitles" → "Generate Subtitles"
4. Wait for transcription (longer videos take more time due to chunking)
5. Refresh page → subtitles should auto-load from cache

## Backing Up IndexedDB

The transcript cache uses IndexedDB (`asbplayer-transcript-cache`). To backup:

### Option 1: Browser DevTools
1. Open DevTools (F12) on any YouTube page with asbplayer active
2. Go to Application → IndexedDB → `asbplayer-transcript-cache`
3. Expand the `transcripts` object store
4. Right-click → "Export" (if available) or manually copy data

### Option 2: Console Export Script
```javascript
// Run in DevTools console on a YouTube page
const dbName = 'asbplayer-transcript-cache';
const storeName = 'transcripts';

const request = indexedDB.open(dbName);
request.onsuccess = (event) => {
    const db = event.target.result;
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = () => {
        const data = getAllRequest.result;
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'transcript-cache-backup.json';
        a.click();
    };
};
```

### Option 3: IndexedDB Export Extension
Use a browser extension like "IndexedDB Exporter" to export/import databases.
