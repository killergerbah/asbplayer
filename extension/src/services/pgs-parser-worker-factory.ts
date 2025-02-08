export const pgsParserWorkerFactory = async () => {
    const code = await (await fetch(chrome.runtime.getURL('./pgs-parser-worker.js'))).text();
    const blob = new Blob([code], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
};
