import React, { useEffect, useRef, useState } from 'react';
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';
import { useTranslation } from 'react-i18next';
import InputAdornment from '@material-ui/core/InputAdornment';
import IconButton from '@material-ui/core/IconButton';
import AddIcon from '@material-ui/icons/Add';
import ClearIcon from '@material-ui/icons/Clear';
import DeleteIcon from '@material-ui/icons/Delete';

const maxProfileNameLength = 16;
const maxProfiles = 5;

interface Props {
    profiles: string[];
    activeProfile?: string;
    onNewProfile: (name: string) => void;
    onRemoveProfile: (name: string) => void;
    onSetActiveProfile: (name: string | undefined) => void;
}

export default function SettingsProfileSelectMenu({
    profiles,
    activeProfile,
    onNewProfile,
    onRemoveProfile,
    onSetActiveProfile,
}: Props) {
    const { t } = useTranslation();
    const [addingNewProfile, setAddingNewProfile] = useState<boolean>(false);
    const newProfileInput = useRef<HTMLInputElement>();
    const [newProfile, setNewProfile] = useState<string>('');
    const trimmed = newProfile.trim();
    const validNewProfile =
        trimmed !== '' &&
        trimmed !== '-' &&
        trimmed.length >= 1 &&
        trimmed.length <= maxProfileNameLength &&
        !profiles.includes(trimmed);

    useEffect(() => {
        if (!addingNewProfile) {
            return;
        }

        const keyListener = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                if (!validNewProfile) {
                    return;
                }

                setAddingNewProfile(false);
                onNewProfile(newProfile.trim());
            }
        };

        document.addEventListener('keypress', keyListener);
        return () => document.removeEventListener('keypress', keyListener);
    }, [addingNewProfile, newProfile, onNewProfile, validNewProfile]);
    const limitReached = profiles.length >= maxProfiles;

    return (
        <>
            {addingNewProfile && (
                <TextField
                    inputRef={(input) => {
                        newProfileInput.current = input;
                        input?.focus();
                    }}
                    fullWidth
                    color="secondary"
                    label={t('settings.profileName')}
                    placeholder={t('settings.enterProfileName')!}
                    value={newProfile}
                    onChange={(e) => {
                        setNewProfile(e.target.value);
                    }}
                    inputProps={{ maxLength: maxProfileNameLength }}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    onClick={() => {
                                        setAddingNewProfile(false);
                                    }}
                                >
                                    <ClearIcon />
                                </IconButton>
                                <IconButton
                                    disabled={!validNewProfile}
                                    onClick={() => {
                                        setAddingNewProfile(false);
                                        onNewProfile(newProfile.trim());
                                    }}
                                >
                                    <AddIcon />
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
            )}
            {!addingNewProfile && (
                <TextField
                    select
                    fullWidth
                    color="secondary"
                    label={t('settings.activeProfile')}
                    value={activeProfile ?? '-'}
                >
                    <MenuItem key={''} value={'-'} onClick={() => onSetActiveProfile(undefined)}>
                        {t('settings.defaultProfile')}
                    </MenuItem>
                    {profiles.map((p, i) => {
                        return (
                            <MenuItem divider={i === profiles.length - 1} key={p} value={p}>
                                <div
                                    onClick={(e) => {
                                        if (e.currentTarget === e.target) {
                                            onSetActiveProfile(p);
                                        }
                                    }}
                                    style={{ flexGrow: 1 }}
                                >
                                    {p}
                                </div>
                                {activeProfile !== p && (
                                    <IconButton>
                                        <DeleteIcon
                                            onClick={(e) => {
                                                e.nativeEvent.stopPropagation();
                                                onRemoveProfile(p);
                                            }}
                                            fontSize="small"
                                        />
                                    </IconButton>
                                )}
                            </MenuItem>
                        );
                    })}
                    <MenuItem
                        disabled={limitReached}
                        onClick={() => {
                            setNewProfile('');
                            setAddingNewProfile(true);
                        }}
                        style={{ textAlign: 'center' }}
                    >
                        {limitReached ? t('settings.profileLimitReached') : t('settings.newProfile')}
                    </MenuItem>
                </TextField>
            )}
        </>
    );
}
