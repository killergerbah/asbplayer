export function extractExtension(url: string, fallback: string) {
    const dotIndex = url.lastIndexOf('.');
    let extension = fallback;

    if (dotIndex !== -1) {
        extension = url.substring(dotIndex + 1);
    }

    return extension;
}
