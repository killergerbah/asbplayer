export function bufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const length = bytes.byteLength;

    for (let i = 0; i < length; ++i) {
        binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
}

export async function fileUrlToBase64(fileUrl: string): Promise<string> {
    return bufferToBase64(await (await fetch(fileUrl)).arrayBuffer());
}
