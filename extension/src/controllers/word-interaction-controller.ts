import {
    VideoToExtensionCommand,
    LLMTranslateMessage,
    LLMTranslateResponse,
    SaveWordMessage,
    SaveWordResponse,
} from '@project/common';
import { v4 as uuidv4 } from 'uuid';
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom';

interface TooltipState {
    element: HTMLElement | null;
    word: string;
    translation: string;
    loading: boolean;
}

interface SelectionState {
    isSelecting: boolean;
    startWord: HTMLElement | null;
    selectedWords: HTMLElement[];
    sentence: string;
}

export default class WordInteractionController {
    private readonly video: HTMLMediaElement;
    private readonly getVideoTitle: () => string;
    private readonly getVideoUrl: () => string;

    private tooltip: HTMLElement | null = null;
    private tooltipState: TooltipState = { element: null, word: '', translation: '', loading: false };
    private tooltipWordElement: HTMLElement | null = null;
    private tooltipCleanup: (() => void) | null = null;
    private hoverTimeout: NodeJS.Timeout | null = null;
    private selectionState: SelectionState = { isSelecting: false, startWord: null, selectedWords: [], sentence: '' };
    private tooltipSentence: string = '';
    private selectionOverlay: HTMLElement | null = null;
    private cachedTranslations: Map<string, string> = new Map();
    private boundVideoTimeUpdate: (() => void) | null = null;
    private boundVideoPlaying: (() => void) | null = null;
    private boundHandlers: {
        mouseEnter: (e: Event) => void;
        mouseLeave: (e: Event) => void;
        contextMenu: (e: Event) => void;
        mouseDown: (e: Event) => void;
        mouseMove: (e: Event) => void;
        mouseUp: (e: Event) => void;
    };
    private enabled: boolean = false;

    constructor(
        video: HTMLMediaElement,
        getVideoTitle: () => string,
        getVideoUrl: () => string
    ) {
        this.video = video;
        this.getVideoTitle = getVideoTitle;
        this.getVideoUrl = getVideoUrl;

        this.boundHandlers = {
            mouseEnter: this._handleMouseEnter.bind(this),
            mouseLeave: this._handleMouseLeave.bind(this),
            contextMenu: this._handleContextMenu.bind(this),
            mouseDown: this._handleMouseDown.bind(this),
            mouseMove: this._handleMouseMove.bind(this),
            mouseUp: this._handleMouseUp.bind(this),
        };
    }

    bind() {
        if (this.enabled) return;
        this.enabled = true;

        // Clean up any stale tooltip/overlay elements from previous script reloads
        document.querySelectorAll('.asbplayer-translation-tooltip').forEach((el) => el.remove());
        document.querySelectorAll('.asbplayer-selection-overlay').forEach((el) => el.remove());

        // Use event delegation on the document
        document.addEventListener('mouseenter', this.boundHandlers.mouseEnter, true);
        document.addEventListener('mouseleave', this.boundHandlers.mouseLeave, true);
        document.addEventListener('contextmenu', this.boundHandlers.contextMenu, true);
        document.addEventListener('mousedown', this.boundHandlers.mouseDown, true);
        document.addEventListener('mousemove', this.boundHandlers.mouseMove, true);
        document.addEventListener('mouseup', this.boundHandlers.mouseUp, true);

        // Listen to video timeupdate to clear selection/tooltip when subtitle changes
        this.boundVideoTimeUpdate = () => {
            this._checkAndClearStaleUI();
        };
        this.video.addEventListener('timeupdate', this.boundVideoTimeUpdate);

        // Clear tooltip when video starts playing (e.g., after pause-on-hover ends)
        this.boundVideoPlaying = () => {
            this._hideTooltip();
            this._clearSelection();
        };
        this.video.addEventListener('playing', this.boundVideoPlaying);
    }

    private _checkAndClearStaleUI() {
        // Check if selection is stale
        if (this.selectionState.selectedWords.length > 0) {
            const firstWord = this.selectionState.selectedWords[0];
            const container = firstWord.closest('.asbplayer-subtitles, .asbplayer-fullscreen-subtitles');
            const currentSentence = firstWord.dataset.sentence || '';
            const isStale = !firstWord.isConnected ||
                            !container ||
                            !document.body.contains(container) ||
                            (this.selectionState.sentence && currentSentence !== this.selectionState.sentence);
            if (isStale) {
                this._clearSelection();
            }
        }

        // Check if tooltip is stale
        if (this.tooltipWordElement) {
            const container = this.tooltipWordElement.closest('.asbplayer-subtitles, .asbplayer-fullscreen-subtitles');
            const currentSentence = this.tooltipWordElement.dataset.sentence || '';
            const isStale = !this.tooltipWordElement.isConnected ||
                            !container ||
                            !document.body.contains(container) ||
                            (this.tooltipSentence && currentSentence !== this.tooltipSentence);
            if (isStale) {
                this._hideTooltip();
            }
        }
    }

    unbind() {
        if (!this.enabled) return;
        this.enabled = false;

        document.removeEventListener('mouseenter', this.boundHandlers.mouseEnter, true);
        document.removeEventListener('mouseleave', this.boundHandlers.mouseLeave, true);
        document.removeEventListener('contextmenu', this.boundHandlers.contextMenu, true);
        document.removeEventListener('mousedown', this.boundHandlers.mouseDown, true);
        document.removeEventListener('mousemove', this.boundHandlers.mouseMove, true);
        document.removeEventListener('mouseup', this.boundHandlers.mouseUp, true);

        if (this.boundVideoTimeUpdate) {
            this.video.removeEventListener('timeupdate', this.boundVideoTimeUpdate);
            this.boundVideoTimeUpdate = null;
        }

        if (this.boundVideoPlaying) {
            this.video.removeEventListener('playing', this.boundVideoPlaying);
            this.boundVideoPlaying = null;
        }

        this._hideTooltip();
        this._clearSelection();

        // Remove selection overlay from DOM
        if (this.selectionOverlay) {
            this.selectionOverlay.remove();
            this.selectionOverlay = null;
        }
    }

    private _isWordElement(target: EventTarget | null): target is HTMLElement {
        return target instanceof HTMLElement && target.classList.contains('asbplayer-word');
    }

    private _handleMouseEnter(e: Event) {
        const target = e.target;
        if (!this._isWordElement(target)) return;

        // Clear any existing timeout
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
        }

        // Debounce the tooltip show
        this.hoverTimeout = setTimeout(() => {
            // Don't show tooltip if video is playing (user probably moved mouse away)
            if (!this.video.paused) {
                return;
            }

            // Check if hovering over a selected word - if so, show chunk translation
            if (this.selectionState.selectedWords.length > 1 &&
                this.selectionState.selectedWords.includes(target)) {
                const words = this.selectionState.selectedWords.map((el) => el.dataset.word || '').join(' ');
                const sentence = this.selectionState.selectedWords[0]?.dataset.sentence || '';
                const lastWord = this.selectionState.selectedWords[this.selectionState.selectedWords.length - 1];
                this._showTooltip(lastWord, words, sentence);
            } else {
                const word = target.dataset.word;
                const sentence = target.dataset.sentence;
                if (word && sentence) {
                    this._showTooltip(target, word, sentence);
                }
            }
        }, 300);
    }

    private _handleMouseLeave(e: Event) {
        const target = e.target;
        if (!this._isWordElement(target)) return;

        // Clear pending hover timeout
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = null;
        }

        // For chunk selections, only hide tooltip when leaving ALL selected words
        // (handled by mousemove checking if we're still over a selected word)
        if (this.selectionState.selectedWords.length > 1) {
            // Don't hide here - let mousemove handle it when we leave all selected words
            return;
        }

        // For single word tooltips, hide when leaving the word
        if (this.tooltipWordElement === target) {
            this._hideTooltip();
        }
    }

    private _handleContextMenu(e: Event) {
        const target = e.target;
        if (!this._isWordElement(target)) return;

        e.preventDefault();
        e.stopPropagation();

        // Check if there's a selection
        if (this.selectionState.selectedWords.length > 0) {
            this._saveSelectedWords();
        } else {
            // Save single word
            const word = target.dataset.word;
            const sentence = target.dataset.sentence;
            if (word && sentence) {
                const translation = this.cachedTranslations.get(`${word}::${sentence}`) || '';
                this._saveWord(word, sentence, translation);
            }
        }
    }

    private _handleMouseDown(e: Event) {
        const target = e.target;
        if (!this._isWordElement(target)) return;
        if ((e as MouseEvent).button !== 0) return; // Only left click

        this._clearSelection();
        this.selectionState.isSelecting = true;
        this.selectionState.startWord = target;
        this.selectionState.selectedWords = [target];
        this.selectionState.sentence = target.dataset.sentence || '';
        this._updateSelectionOverlay();
    }

    private _handleMouseMove(e: Event) {
        const target = e.target;

        // If tooltip is showing but mouse is not over the tooltip's word element, hide it
        // This handles cases where mouseLeave doesn't fire (e.g., element removed from DOM)
        if (this.tooltipWordElement && target !== this.tooltipWordElement) {
            // Don't hide if we're hovering over another word in the current selection
            const isOverSelectedWord = this.selectionState.selectedWords.length > 1 &&
                target instanceof HTMLElement &&
                this.selectionState.selectedWords.includes(target);

            if (!isOverSelectedWord) {
                // Check if target is a descendant of tooltipWordElement (shouldn't happen, but be safe)
                if (!(target instanceof Node) || !this.tooltipWordElement.contains(target)) {
                    this._hideTooltip();
                }
            }
        }

        if (!this.selectionState.isSelecting) return;

        if (!this._isWordElement(target)) return;

        // Get all words between start and current
        const startWord = this.selectionState.startWord;
        if (!startWord) return;

        // Find all words in the same subtitle container
        const container = startWord.closest('.asbplayer-subtitles, .asbplayer-fullscreen-subtitles');
        if (!container) return;

        const allWords = Array.from(container.querySelectorAll('.asbplayer-word'));
        const startIndex = allWords.indexOf(startWord);
        const currentIndex = allWords.indexOf(target);

        if (startIndex === -1 || currentIndex === -1) return;

        // Select all words between start and current (inclusive)
        const minIndex = Math.min(startIndex, currentIndex);
        const maxIndex = Math.max(startIndex, currentIndex);
        const newSelection = allWords.slice(minIndex, maxIndex + 1) as HTMLElement[];

        this.selectionState.selectedWords = newSelection;
        this._updateSelectionOverlay();
    }

    private _handleMouseUp(_e: Event) {
        if (!this.selectionState.isSelecting) return;
        this.selectionState.isSelecting = false;
    }

    private _updateSelectionOverlay() {
        if (this.selectionState.selectedWords.length === 0) {
            this._hideSelectionOverlay();
            return;
        }

        const firstWord = this.selectionState.selectedWords[0];
        const lastWord = this.selectionState.selectedWords[this.selectionState.selectedWords.length - 1];

        // Find the subtitle container to append overlay to
        const container = firstWord.closest('.asbplayer-subtitles, .asbplayer-fullscreen-subtitles') as HTMLElement;
        if (!container) {
            this._hideSelectionOverlay();
            return;
        }

        // Create overlay if it doesn't exist or if it's in a different container
        if (!this.selectionOverlay || this.selectionOverlay.parentElement !== container) {
            if (this.selectionOverlay) {
                this.selectionOverlay.remove();
            }
            this.selectionOverlay = document.createElement('div');
            this.selectionOverlay.className = 'asbplayer-selection-overlay';
            container.appendChild(this.selectionOverlay);
        }

        // Get container's position for relative calculations
        const containerRect = container.getBoundingClientRect();
        const firstRect = firstWord.getBoundingClientRect();
        const lastRect = lastWord.getBoundingClientRect();

        // Calculate the combined bounding box relative to container
        const top = Math.min(firstRect.top, lastRect.top) - containerRect.top;
        const bottom = Math.max(firstRect.bottom, lastRect.bottom) - containerRect.top;
        const left = Math.min(firstRect.left, lastRect.left) - containerRect.left;
        const right = Math.max(firstRect.right, lastRect.right) - containerRect.left;

        // Position and size the overlay relative to container
        Object.assign(this.selectionOverlay.style, {
            display: 'block',
            top: `${top - 2}px`,
            left: `${left - 2}px`,
            width: `${right - left + 4}px`,
            height: `${bottom - top + 4}px`,
        });
    }

    private _hideSelectionOverlay() {
        if (this.selectionOverlay) {
            this.selectionOverlay.style.display = 'none';
        }
    }

    private _clearSelection() {
        this.selectionState.selectedWords = [];
        this.selectionState.startWord = null;
        this.selectionState.isSelecting = false;
        this.selectionState.sentence = '';
        this._hideSelectionOverlay();
    }

    private async _showTooltip(wordElement: HTMLElement, word: string, sentence: string) {
        const cacheKey = `${word}::${sentence}`;

        // Get translation first (either from cache or API)
        let translation: string;
        if (this.cachedTranslations.has(cacheKey)) {
            translation = this.cachedTranslations.get(cacheKey)!;
        } else {
            try {
                translation = await this._requestTranslation(word, sentence);
                this.cachedTranslations.set(cacheKey, translation);
            } catch (error) {
                translation = 'Translation error';
            }
        }

        // Check if we should still show the tooltip (user might have moved away during request)
        // Video playing means user moved away (with pause-on-hover)
        if (!this.video.paused) {
            return;
        }

        // Check if the word element is still valid
        if (!wordElement.isConnected) {
            return;
        }

        // Track the word element and sentence the tooltip is attached to
        this.tooltipWordElement = wordElement;
        this.tooltipSentence = sentence;

        // Clean up any existing autoUpdate
        if (this.tooltipCleanup) {
            this.tooltipCleanup();
            this.tooltipCleanup = null;
        }

        // Create tooltip if it doesn't exist
        if (!this.tooltip) {
            this.tooltip = document.createElement('div');
            this.tooltip.className = 'asbplayer-translation-tooltip';
            document.body.appendChild(this.tooltip);
        }

        // Set content and show tooltip
        this.tooltip.textContent = translation || 'No translation available';
        this.tooltip.style.display = 'block';

        // Use Floating UI for positioning with auto-update
        const updatePosition = () => {
            if (!this.tooltip || !this.tooltipWordElement) return;

            computePosition(wordElement, this.tooltip, {
                placement: 'top',
                middleware: [
                    offset(8),
                    flip({ fallbackPlacements: ['bottom', 'top'] }),
                    shift({ padding: 5 }),
                ],
            }).then(({ x, y }) => {
                if (this.tooltip) {
                    Object.assign(this.tooltip.style, {
                        left: `${x}px`,
                        top: `${y}px`,
                        transform: '',
                    });
                }
            });
        };

        // Set up autoUpdate to handle scroll/resize and keep tooltip positioned
        this.tooltipCleanup = autoUpdate(wordElement, this.tooltip, updatePosition);
    }

    private _hideTooltip() {
        this.tooltipWordElement = null;
        this.tooltipSentence = '';

        // Clean up Floating UI autoUpdate
        if (this.tooltipCleanup) {
            this.tooltipCleanup();
            this.tooltipCleanup = null;
        }

        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }
    }

    private async _requestTranslation(word: string, sentence: string): Promise<string> {
        const message: VideoToExtensionCommand<LLMTranslateMessage> = {
            sender: 'asbplayer-video-tab',
            message: {
                command: 'llm-translate',
                messageId: uuidv4(),
                word,
                sentence,
                sourceLanguage: 'Russian',
                targetLanguage: 'English',
            },
            src: this.video.src,
        };

        const response: LLMTranslateResponse = await browser.runtime.sendMessage(message);

        if (response.error) {
            console.warn('LLM translation error:', response.error);
            return '';
        }

        return response.translation;
    }

    private async _saveWord(word: string, sentence: string, translation: string) {
        const message: VideoToExtensionCommand<SaveWordMessage> = {
            sender: 'asbplayer-video-tab',
            message: {
                command: 'save-word',
                messageId: uuidv4(),
                word,
                sentence,
                translation,
                videoTitle: this.getVideoTitle(),
                videoUrl: this.getVideoUrl(),
            },
            src: this.video.src,
        };

        const response: SaveWordResponse = await browser.runtime.sendMessage(message);

        if (response.success) {
            this._showSaveNotification(word);
        } else {
            console.error('Failed to save word:', response.error);
        }

        this._clearSelection();
    }

    private async _saveSelectedWords() {
        if (this.selectionState.selectedWords.length === 0) return;

        // Combine selected words into a phrase
        const words = this.selectionState.selectedWords.map((el) => el.dataset.word || '').join(' ');
        const sentence = this.selectionState.selectedWords[0]?.dataset.sentence || '';

        // Try to get cached translation for the phrase, or use individual translations
        const cacheKey = `${words}::${sentence}`;
        let translation = this.cachedTranslations.get(cacheKey);

        if (!translation) {
            // Request translation for the whole phrase
            try {
                translation = await this._requestTranslation(words, sentence);
                this.cachedTranslations.set(cacheKey, translation);
            } catch {
                translation = '';
            }
        }

        await this._saveWord(words, sentence, translation);
    }

    private _showSaveNotification(word: string) {
        const notification = document.createElement('div');
        notification.className = 'asbplayer-save-notification';
        notification.textContent = `Saved: ${word}`;
        document.body.appendChild(notification);

        // Position near bottom center of video
        const videoRect = this.video.getBoundingClientRect();
        notification.style.left = `${videoRect.left + videoRect.width / 2 - notification.offsetWidth / 2}px`;
        notification.style.top = `${videoRect.bottom - 60}px`;

        // Remove after animation
        setTimeout(() => {
            notification.remove();
        }, 1500);
    }
}
