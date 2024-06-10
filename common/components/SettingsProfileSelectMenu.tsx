import React, { useEffect, useRef, useState } from 'react';
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';
import { useTranslation } from 'react-i18next';
import InputAdornment from '@material-ui/core/InputAdornment';
import IconButton from '@material-ui/core/IconButton';
import CheckIcon from '@material-ui/icons/Check';
import ClearIcon from '@material-ui/icons/Clear';
import DeleteIcon from '@material-ui/icons/Delete';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { Profile } from '../settings';
import { TFunction } from 'i18next';

const maxProfileNameLength = 16;
const maxProfiles = 5;

interface Props {
    profiles: Profile[];
    activeProfile?: string;
    onNewProfile: (name: string) => void;
    onRemoveProfile: (name: string) => void;
    onSetActiveProfile: (name: string | undefined) => void;
}

const useStyles = makeStyles({
    newProfileTextField: {
        '& .MuiInputBase-root': {
            paddingRight: 0,
        },
    },
    menu: {
        '& .MuiSelect-root': {
            padding: 0,
        },
    },
});

interface ProfileMenuStyleProps {
    collapsed: boolean;
}

interface ProfileMenuItemProps {
    profile?: Profile;
    onRemoveProfile: (name: string) => void;
    onSetActiveProfile: (name: string | undefined) => void;
    divider: boolean;
    collapsed: boolean;
    t: TFunction;
    className: string;
}

const useMenuItemStyles = makeStyles<Theme, ProfileMenuStyleProps>({
    root: ({ collapsed }) =>
        collapsed
            ? {
                  '&:hover': {
                      backgroundColor: 'transparent',
                  },
                  margin: 0,
              }
            : { margin: 0 },
});

// MUI requires <MenuItem> to be a direct descendent of the parent select menu.
// So this function is not itself a component, but returns the <MenuItem> component instead.
function renderMenuItem({
    onRemoveProfile,
    onSetActiveProfile,
    divider,
    profile,
    collapsed,
    t,
    className,
}: ProfileMenuItemProps) {
    return (
        <MenuItem key={profile?.name ?? ''} className={className} divider={divider} value={profile?.name ?? '-'}>
            <div
                onClick={(e) => {
                    if (e.currentTarget === e.target) {
                        onSetActiveProfile(profile?.name);
                    }
                }}
                style={{ flexGrow: 1 }}
            >
                {profile?.name ?? t('settings.defaultProfile')}
            </div>

            {profile !== undefined && (
                <IconButton
                    onClick={(e) => {
                        onRemoveProfile(profile.name);
                    }}
                    style={{ padding: 4, marginRight: collapsed ? 16 : 0 }}
                >
                    <DeleteIcon fontSize="small" />
                </IconButton>
            )}
        </MenuItem>
    );
}

export default function SettingsProfileSelectMenu({
    profiles,
    activeProfile,
    onNewProfile,
    onRemoveProfile,
    onSetActiveProfile,
}: Props) {
    const { t } = useTranslation();
    const classes = useStyles();
    const collapsedMenuItemStyles = useMenuItemStyles({ collapsed: true });
    const expandedMenuItemStyles = useMenuItemStyles({ collapsed: false });

    const [addingNewProfile, setAddingNewProfile] = useState<boolean>(false);
    const newProfileInput = useRef<HTMLInputElement>();
    const [newProfile, setNewProfile] = useState<string>('');
    const trimmed = newProfile.trim();
    const validNewProfile =
        trimmed !== '' &&
        trimmed !== '-' &&
        trimmed.length >= 1 &&
        trimmed.length <= maxProfileNameLength &&
        profiles.find((p) => p.name === trimmed) === undefined;

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
                    className={classes.newProfileTextField}
                    fullWidth
                    size="small"
                    color="secondary"
                    variant="outlined"
                    style={{ paddingRight: 0 }}
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
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    disabled={!validNewProfile}
                                    onClick={() => {
                                        setAddingNewProfile(false);
                                        onNewProfile(newProfile.trim());
                                    }}
                                >
                                    <CheckIcon fontSize="small" />
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
                    className={classes.menu}
                    size="small"
                    color="secondary"
                    variant="outlined"
                    label={t('settings.activeProfile')}
                    value={activeProfile ?? '-'}
                    SelectProps={{
                        renderValue: (option) => {
                            return renderMenuItem({
                                profile: profiles.find((p) => p.name === option)!,
                                divider: false,
                                onRemoveProfile,
                                onSetActiveProfile,
                                collapsed: true,
                                t,
                                className: collapsedMenuItemStyles.root,
                            });
                        },
                    }}
                >
                    <MenuItem key={''} value={'-'} onClick={() => onSetActiveProfile(undefined)}>
                        {t('settings.defaultProfile')}
                    </MenuItem>
                    {profiles.map((profile, index) => {
                        return renderMenuItem({
                            profile,
                            divider: index === profiles.length - 1,
                            onRemoveProfile,
                            onSetActiveProfile,
                            collapsed: false,
                            t,
                            className: expandedMenuItemStyles.root,
                        });
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
