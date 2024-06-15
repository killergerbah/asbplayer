import { Profile, SettingsProvider } from '../settings';
import { useEffect, useState, useCallback } from 'react';

interface Params {
    settingsProvider: SettingsProvider;
    onProfileChanged: () => void;
}

export const useSettingsProfileContext = ({ settingsProvider, onProfileChanged }: Params) => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [activeProfile, setActiveProfile] = useState<string>();
    const refreshProfileContext = useCallback(() => {
        settingsProvider.profiles().then(setProfiles);
        settingsProvider.activeProfile().then((p) => setActiveProfile(p?.name));
    }, [settingsProvider]);
    useEffect(() => {
        refreshProfileContext();
    }, [refreshProfileContext]);

    const onNewProfile = useCallback(
        (name: string) =>
            settingsProvider
                .addProfile(name)
                .then(() => settingsProvider.profiles().then(setProfiles))
                .then(() => settingsProvider.setActiveProfile(name))
                .then(() => setActiveProfile(name))
                .then(() => onProfileChanged()),
        [settingsProvider, onProfileChanged]
    );
    const onRemoveProfile = useCallback(
        async (name: string) => {
            if (name === activeProfile) {
                await settingsProvider.setActiveProfile(undefined);
                setActiveProfile(undefined);
                onProfileChanged();
            }

            settingsProvider.removeProfile(name).then(() => settingsProvider.profiles().then(setProfiles));
        },
        [settingsProvider, activeProfile, onProfileChanged]
    );
    const onSetActiveProfile = useCallback(
        (name: string | undefined) =>
            settingsProvider
                .setActiveProfile(name)
                .then(() => setActiveProfile(name))
                .then(() => onProfileChanged()),
        [settingsProvider, onProfileChanged]
    );

    return { profiles, activeProfile, onNewProfile, onRemoveProfile, onSetActiveProfile, refreshProfileContext };
};
