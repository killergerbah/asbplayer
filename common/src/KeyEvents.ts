export default class KeyEvents {
    static detectCopy(event: KeyboardEvent) {
        // Ctrl + Shift + A
        return event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a';
    }

    static detectDecreaseOffset(event: KeyboardEvent) {
        // Ctrl + Shift + Right
        return event.ctrlKey && event.shiftKey && event.key === 'ArrowRight';
    }

    static detectAnkiExport(event: KeyboardEvent) {
        // Ctrl + Shift + Q
        return event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'q';
    }

    static detectUpdateLastCard(event: KeyboardEvent) {
        // Ctrl + Shift + Y
        return event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'y';
    }

    static detectIncreaseOffset(event: KeyboardEvent) {
        // Ctrl + Shift + Left
        return event.ctrlKey && event.shiftKey && event.key === 'ArrowLeft';
    }

    static detectDecreaseOffsetToNextSubtitle(event: KeyboardEvent) {
        // Ctrl + Right
        return (
            !KeyEvents.detectDecreaseOffset(event) && (event.ctrlKey || event.shiftKey) && event.key === 'ArrowRight'
        );
    }

    static detectIncreaseOffsetToPreviousSubtitle(event: KeyboardEvent) {
        // Ctrl + Left
        return !KeyEvents.detectIncreaseOffset(event) && (event.ctrlKey || event.shiftKey) && event.key === 'ArrowLeft';
    }

    static detectPreviousSubtitle(event: KeyboardEvent) {
        // Left
        return (
            !KeyEvents.detectIncreaseOffset(event) &&
            !KeyEvents.detectIncreaseOffsetToPreviousSubtitle(event) &&
            event.key === 'ArrowLeft'
        );
    }

    static detectNextSubtitle(event: KeyboardEvent) {
        // Right
        return (
            !KeyEvents.detectDecreaseOffset(event) &&
            !KeyEvents.detectDecreaseOffsetToNextSubtitle(event) &&
            event.key === 'ArrowRight'
        );
    }

    static detectCurrentSubtitle(event: KeyboardEvent) {
        // Down
        return event.key === 'ArrowDown';
    }

    static detectSeekBackward(event: KeyboardEvent) {
        // A
        return !KeyEvents.detectCopy(event) && event.key.toLowerCase() === 'a';
    }

    static detectSeekForward(event: KeyboardEvent) {
        // D
        return event.key.toLowerCase() === 'd';
    }

    static detectPlay(event: KeyboardEvent) {
        // Space
        return event.key === ' ';
    }

    static detectAutoPause(event: KeyboardEvent) {
        // Shift + P
        return event.shiftKey && event.key.toLowerCase() === 'p';
    }
}
