import { SettingsProvider } from '../settings';
import { useEffect, useState, useCallback } from 'react';

interface Params {
    settingsProvider: SettingsProvider;
    onProfileChanged: () => void;
}

export const useSettingsProfileContext = ({ settingsProvider, onProfileChanged }: Params) => {
    const [profiles, setProfiles] = useState<string[]>([]);
    const [activeProfile, setActiveProfile] = useState<string>();
    useEffect(() => {
        settingsProvider.profiles().then(setProfiles);
        settingsProvider.activeProfile().then(setActiveProfile);
    }, [settingsProvider]);

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
        (name: string) =>
            settingsProvider.removeProfile(name).then(() => settingsProvider.profiles().then(setProfiles)),
        [settingsProvider]
    );
    const onSetActiveProfile = useCallback(
        (name: string | undefined) =>
            settingsProvider
                .setActiveProfile(name)
                .then(() => setActiveProfile(name))
                .then(() => onProfileChanged()),
        [settingsProvider, onProfileChanged]
    );

    return { profiles, activeProfile, onNewProfile, onRemoveProfile, onSetActiveProfile };
};
