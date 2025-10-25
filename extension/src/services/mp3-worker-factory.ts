import { createTrustedWorker } from './trusted-types';

export const mp3WorkerFactory = () => {
    return createTrustedWorker(browser.runtime.getURL('/mp3-encoder-worker.js'));
};
