import Button from '@material-ui/core/Button';
import Popover from '@material-ui/core/Popover';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Profile } from '../settings';

interface Props {
    profiles: Profile[];
    activeProfile?: string;
    onSetActiveProfile: (profile: string | undefined) => void;
}

const MiniProfileSelector = ({ profiles, activeProfile, onSetActiveProfile }: Props) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState<boolean>(false);
    const [anchorEl, setAnchorEl] = useState<HTMLElement>();
    const handleOpen = useCallback((e: React.MouseEvent) => {
        setAnchorEl(e.currentTarget as HTMLElement);
        setOpen(true);
    }, []);
    const handleClose = useCallback(() => setOpen(false), []);
    const handleSelect = useCallback(
        (p: Profile | undefined) => {
            setOpen(false);
            onSetActiveProfile(p?.name);
        },
        [onSetActiveProfile]
    );
    if (profiles.length === 0) {
        return null;
    }

    return (
        <>
            <Popover open={open} anchorEl={anchorEl} onClose={handleClose}>
                <List>
                    <ListItem button selected={activeProfile === undefined} onClick={() => handleSelect(undefined)}>
                        {t('settings.defaultProfile')}
                    </ListItem>
                    {profiles.map((p) => (
                        <ListItem
                            key={p.name}
                            button
                            selected={p.name === activeProfile}
                            onClick={() => handleSelect(p)}
                        >
                            {p.name}
                        </ListItem>
                    ))}
                </List>
            </Popover>
            <Button variant="outlined" onClick={handleOpen}>
                {activeProfile ?? t('settings.defaultProfile')}
            </Button>
        </>
    );
};

export default MiniProfileSelector;
