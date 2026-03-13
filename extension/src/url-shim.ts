// Minimal browser shim for Node's 'url' module, used by jsonschema

export function parse(urlStr: string) {
    try {
        return new URL(urlStr);
    } catch {
        return { protocol: null, host: null, pathname: urlStr, href: urlStr };
    }
}

export function resolve(base: string, relative: string): string {
    try {
        return new URL(relative, base).href;
    } catch {
        return relative;
    }
}

export function format(urlObject: URL | string): string {
    if (typeof urlObject === 'string') return urlObject;
    return urlObject?.href ?? '';
}
