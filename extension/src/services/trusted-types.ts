let workerPolicy: any = null;

export function createTrustedWorker(url: string): Worker {
    // Handle Trusted Types for CSP compliance (e.g. YouTube)
    if (typeof window.trustedTypes !== 'undefined' && !workerPolicy) {
        try {
            workerPolicy = window.trustedTypes.createPolicy('asbplayer-workers', {
                createScriptURL: (url: string) => url,
            });
        } catch (e) {
            console.warn('Failed to create Trusted Types policy for workers:', e);
        }
    }

    if (workerPolicy) {
        return new Worker(workerPolicy.createScriptURL(url));
    }

    return new Worker(url);
}
