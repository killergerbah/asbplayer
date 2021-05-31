export function arrayEquals(a, b, equals = (a, b) => a === b) {
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

export function keysAreEqual(a, b) {
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

// https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
export function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    }
}
