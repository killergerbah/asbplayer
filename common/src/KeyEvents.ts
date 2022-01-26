export default class KeyEvents {
    static detectCopy(event: KeyboardEvent) {
        // Ctrl + Shift + A
        return event.ctrlKey && event.shiftKey && event.keyCode === 65;
    }

    static detectDecreaseOffset(event: KeyboardEvent) {
        // Ctrl + Shift + Right
        return event.ctrlKey && event.shiftKey && event.keyCode === 39;
    }

    static detectAnkiExport(event: KeyboardEvent) {
        // Ctrl + Shift + Q
        return event.ctrlKey && event.shiftKey && event.keyCode === 81;
    }

    static detectIncreaseOffset(event: KeyboardEvent) {
        // Ctrl + Shift + Left
        return event.ctrlKey && event.shiftKey && event.keyCode === 37;
    }

    static detectDecreaseOffsetToNextSubtitle(event: KeyboardEvent) {
        // Ctrl + Right
        return !KeyEvents.detectDecreaseOffset(event) && (event.ctrlKey || event.shiftKey) && event.keyCode === 39;
    }

    static detectIncreaseOffsetToPreviousSubtitle(event: KeyboardEvent) {
        // Ctrl + Left
        return !KeyEvents.detectIncreaseOffset(event) && (event.ctrlKey || event.shiftKey) && event.keyCode === 37;
    }

    static detectPreviousSubtitle(event: KeyboardEvent) {
        // Left
        return (
            !KeyEvents.detectIncreaseOffset(event) &&
            !KeyEvents.detectIncreaseOffsetToPreviousSubtitle(event) &&
            event.keyCode === 37
        );
    }

    static detectNextSubtitle(event: KeyboardEvent) {
        // Right
        return (
            !KeyEvents.detectDecreaseOffset(event) &&
            !KeyEvents.detectDecreaseOffsetToNextSubtitle(event) &&
            event.keyCode === 39
        );
    }

    static detectPlay(event: KeyboardEvent) {
        // Space
        return event.keyCode === 32;
    }
}
