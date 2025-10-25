let trustedTypePolicy: any = null;

export const mp3WorkerFactory = () => {
    const url = browser.runtime.getURL('/mp3-encoder-worker.js');

    // Handle Trusted Types for CSP compliance (e.g. YouTube)
    if (typeof (window as any).trustedTypes !== 'undefined' && !trustedTypePolicy) {
        try {
            trustedTypePolicy = (window as any).trustedTypes.createPolicy('asbplayer-mp3-worker', {
                createScriptURL: (url: string) => url,
            });
        } catch (e) {
            console.warn('Failed to create Trusted Types policy for mp3 worker:', e);
        }
    }

    if (trustedTypePolicy) {
        return new Worker(trustedTypePolicy.createScriptURL(url));
    }

    return new Worker(url);
};
