export default class KeyEvents {

    static detectCopy(event) {
        // Ctrl + Shift + A
        return event.ctrlKey && event.shiftKey && event.keyCode === 65;
    }

    static detectDecreaseOffset(event) {
        // Ctrl + Shift + Left
        return event.ctrlKey && event.shiftKey && event.keyCode === 37;
    }

    static detectIncreaseOffset(event) {
        // Ctrl + Shift + Right
        return event.ctrlKey && event.shiftKey && event.keyCode === 39;
    }

    static detectDecreaseOffsetToPreviousSubtitle(event) {
        // Ctrl + Left
        return !KeyEvents.detectDecreaseOffset(event) && event.ctrlKey && event.keyCode === 37;
    }

    static detectIncreaseOffsetToNextSubtitle(event) {
        // Ctrl + Right
        return !KeyEvents.detectIncreaseOffset(event) && event.ctrlKey && event.keyCode === 39;
    }

    static detectPreviousSubtitle(event) {
        // Left
        return !KeyEvents.detectDecreaseOffset(event) && !KeyEvents.detectDecreaseOffsetToPreviousSubtitle(event) && event.keyCode === 37;
    }

    static detectNextSubtitle(event) {
        // Right
        return !KeyEvents.detectIncreaseOffset(event) && !KeyEvents.detectIncreaseOffsetToNextSubtitle(event) && event.keyCode === 39;
    }
}