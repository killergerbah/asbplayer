import { useCallback, useEffect, useState } from 'react';
import { CspAdapter } from '../csp-adapter';
import { PageSettings } from '../settings';

export const useDisableCspDnrRule = ({
    cspAdapter,
    pageKey,
}: {
    cspAdapter: CspAdapter | undefined;
    pageKey: keyof PageSettings;
}) => {
    const [cspDisabled, setCspDisabled] = useState<boolean>();
    const refresh = useCallback(() => {
        if (!cspAdapter) {
            return;
        }
        cspAdapter.isCspDisabled(pageKey).then(setCspDisabled);
    }, [cspAdapter, pageKey]);
    useEffect(refresh, [refresh]);
    useEffect(() => {
        if (!cspAdapter) {
            return;
        }
        return cspAdapter.onEvent((eventName) => {
            if (eventName === 'toggle') refresh();
        });
    }, [cspAdapter, refresh]);
    const disableCsp = useCallback(async () => {
        if (!cspAdapter) {
            throw new Error('Missing CspAdapter');
        }
        await cspAdapter.disableCsp(pageKey);
        setCspDisabled(true);
    }, [cspAdapter, pageKey]);
    const enableCsp = useCallback(async () => {
        if (!cspAdapter) {
            throw new Error('Missing CspAdapter');
        }
        await cspAdapter.enableCsp(pageKey);
        setCspDisabled(false);
    }, [cspAdapter, pageKey]);
    return { cspDisabled, enableCsp, disableCsp };
};
