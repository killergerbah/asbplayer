export function humanReadableTime(timestamp) {
    const totalSeconds = Math.floor(timestamp / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    if (hours > 0) {
        return hours + "h" + String(minutes).padStart(2, '0') + "m" + String(seconds).padStart(2, '0') + "s";
    }

    return minutes + "m" + String(seconds).padStart(2, '0') + "s";
}