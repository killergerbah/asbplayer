import type { JitenRequestMessage } from '@project/common';
import { blobToBase64 } from '@project/common/base64';
import { v4 as uuidv4 } from 'uuid';
import type Bridge from '@project/extension/src/ui/bridge';

export function jitenFetcher(bridge: Bridge): typeof fetch {
    return async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const body = init?.body;
        const file = body instanceof FormData ? body.get('file') : undefined;
        const message: JitenRequestMessage = {
            command: 'jiten-request',
            path: new URL(url).pathname.slice('/api'.length),
            method: init?.method ?? 'GET',
            body: typeof body === 'string' ? body : undefined,
            file:
                file instanceof File
                    ? { name: file.name, type: file.type, base64: await blobToBase64(file) }
                    : undefined,
            messageId: uuidv4(),
        };
        const response = await bridge.sendMessageFromServerAndExpectResponse(message, 60_000);
        if (response.error) throw new Error(response.error);
        return new Response(response.text);
    };
}
