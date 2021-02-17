export function arrayEquals(a, b) {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) {
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