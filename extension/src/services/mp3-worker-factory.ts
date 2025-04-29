export const mp3WorkerFactory = async () => {
    const code = await (await fetch(browser.runtime.getURL('/mp3-encoder-worker.js'))).text();
    const blob = new Blob([code], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
};
