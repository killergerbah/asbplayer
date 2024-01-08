import { useCallback, useEffect, useState } from 'react';

// @ts-ignore
const localFontsAvailable = typeof queryLocalFonts === 'function';

export const useLocalFontFamilies = () => {
    const [localFontFamilies, setLocalFontFamilies] = useState<string[]>([]);
    const [localFontsPermission, setLocalFontsPermission] = useState<PermissionState>();
    const updateLocalFontsPermission = useCallback(() => {
        if (localFontsAvailable) {
            navigator.permissions
                .query({ name: 'local-fonts' as PermissionName })
                .then((result) => setLocalFontsPermission(result.state));
        }
    }, []);

    const updateLocalFonts = useCallback(() => {
        if (localFontsAvailable) {
            // @ts-ignore
            queryLocalFonts()
                // @ts-ignore
                .then((fonts) => {
                    const families: { [family: string]: boolean } = {};

                    for (const f of fonts) {
                        families[f.family] = true;
                    }

                    setLocalFontFamilies(Object.keys(families));
                })
                .catch(console.error);
        }
    }, []);

    useEffect(() => {
        updateLocalFontsPermission();
    }, [updateLocalFontsPermission]);

    useEffect(() => {
        updateLocalFonts();
    }, [updateLocalFonts]);

    return {
        updateLocalFontsPermission,
        updateLocalFonts,
        localFontsAvailable,
        localFontsPermission,
        localFontFamilies,
    };
};
