export function arrayEquals(a: any[], b: any[], equals = (a: any, b: any) => a === b) {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; ++i) {
        if (!equals(a[i], b[i])) {
            return false;
        }
    }

    return true;
}

export function keysAreEqual(a: any, b: any) {
    for (let key in a) {
        if (!(key in b)) {
            return false;
        }
    }

    for (let key in b) {
        if (!(key in a)) {
            return false;
        }
    }

    return true;
}

export function timeDurationDisplay(
    milliseconds: number,
    totalMilliseconds: number,
    includeMilliseconds = true
): string {
    if (milliseconds < 0) {
        return timeDurationDisplay(0, totalMilliseconds);
    }

    milliseconds = Math.round(milliseconds);
    const ms = milliseconds % 1000;
    milliseconds = (milliseconds - ms) / 1000;
    const secs = milliseconds % 60;
    milliseconds = (milliseconds - secs) / 60;
    const mins = milliseconds % 60;

    if (totalMilliseconds >= 3600000) {
        const hrs = (milliseconds - mins) / 60;

        if (includeMilliseconds) {
            return pad(hrs) + ':' + pad(mins) + ':' + pad(secs) + '.' + pad(ms, 3);
        }

        return pad(hrs) + ':' + pad(mins) + ':' + pad(secs);
    }

    if (includeMilliseconds) {
        return pad(mins) + ':' + pad(secs) + '.' + pad(ms, 3);
    }

    return pad(mins) + ':' + pad(secs);
}

function pad(n: number, zeros: number = 2) {
    return String(n).padStart(zeros, '0');
}
