let trustedTypePolicy: any = null;

export const pgsParserWorkerFactory = () => {
    const url = browser.runtime.getURL('/pgs-parser-worker.js');

    // Handle Trusted Types for CSP compliance (e.g. YouTube)
    if (typeof (window as any).trustedTypes !== 'undefined' && !trustedTypePolicy) {
        try {
            trustedTypePolicy = (window as any).trustedTypes.createPolicy('asbplayer-pgs-worker', {
                createScriptURL: (url: string) => url,
            });
        } catch (e) {
            console.warn('Failed to create Trusted Types policy for pgs parser worker:', e);
        }
    }

    if (trustedTypePolicy) {
        return new Worker(trustedTypePolicy.createScriptURL(url));
    }

    return new Worker(url);
};
