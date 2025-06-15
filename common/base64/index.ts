export function encodeBase64(str: string) {
  // Browser environment
  if (typeof TextEncoder !== 'undefined') {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const binString = String.fromCharCode(...bytes);
    return btoa(binString);
  }
  
  // Fallback for legacy browsers
  return btoa(unescape(encodeURIComponent(str)));
}

export function base64ToBuffer(base64: string): Uint8Array {
  const str = atob(base64);
  const len = str.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

export function bufferToBase64(buffer: ArrayBufferLike, urlSafe: boolean = false): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const length = bytes.byteLength;

    for (let i = 0; i < length; ++i) {
        binary += String.fromCharCode(bytes[i]);
    }

    const base64 = window.btoa(binary);

    return urlSafe ? base64.replace(/\//g, "_").replace(/\+/g, "-") : base64;
}

export async function urlToBase64(url: string): Promise<string> {
    return bufferToBase64(await (await fetch(url)).arrayBuffer());
}

export const blobToBase64 = (blob: Blob) => {
    return new Promise<string>(async (resolve, reject) => {
        try {
            var reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64 = result.substring(result.indexOf(',') + 1);
                resolve(base64);
            };
        } catch (e) {
            reject(e);
        }
    });
};

export const base64ToBlob = (base64: string, mimeType: string) => {
    const decoded = atob(base64);
    const buffer = new Uint8Array(decoded.length);

    for (let i = 0; i < buffer.length; ++i) {
        buffer[i] = decoded.charCodeAt(i);
    }

    return new Blob([buffer.buffer], { type: mimeType });
};
