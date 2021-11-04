export default class HttpFetcher {
    async fetch(url, body) {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return await response.json();
    }
}
