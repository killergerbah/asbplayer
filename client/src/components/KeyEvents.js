export function detectCopy(event) {
    // Ctrl + Shift + A
    return event.ctrlKey && event.shiftKey && event.keyCode === 65;
}