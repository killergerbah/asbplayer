import { createTrustedWorker } from './trusted-types';

export const pgsParserWorkerFactory = () => {
    return createTrustedWorker(browser.runtime.getURL('/pgs-parser-worker.js'));
};
