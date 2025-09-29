import React from 'react';
import { useTranslation } from 'react-i18next';
import List from '@mui/material/List';
import MuiListItem, { ListItemProps } from '@mui/material/ListItem';
import MuiListItemButton, { ListItemButtonProps } from '@mui/material/ListItemButton';
import Popover from '@mui/material/Popover';
import type { PopoverProps } from '@mui/material/Popover';
import { PlayMode } from '@project/common';
import ListItemText from '@mui/material/ListItemText';

interface Props extends PopoverProps {
    open: boolean;
    listStyle?: React.CSSProperties;
    anchorEl?: Element;
    selectedPlayModes: Set<PlayMode>;
    onPlayMode: (playMode: PlayMode) => void;
    onClose: () => void;
}

const ListItem = ({ children, ...props }: ListItemProps) => {
    return (
        <MuiListItem disablePadding dense {...props}>
            {children}
        </MuiListItem>
    );
};

const ListItemButton = ({ children, ...props }: ListItemButtonProps) => {
    return (
        <MuiListItemButton dense {...props}>
            {children}
        </MuiListItemButton>
    );
};

export default function PlayModeSelector({
    listStyle,
    selectedPlayModes,
    onPlayMode,
    open,
    anchorEl,
    onClose,
    ...restOfPopoverProps
}: Props) {
    const { t } = useTranslation();
    return (
        <Popover
            disableEnforceFocus={true}
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'center',
            }}
            transformOrigin={{
                vertical: 'bottom',
                horizontal: 'center',
            }}
            {...restOfPopoverProps}
        >
            <List disablePadding dense style={listStyle}>
                <ListItem onClick={() => onPlayMode(PlayMode.normal)}>
                    <ListItemButton selected={selectedPlayModes.has(PlayMode.normal)}>
                        <ListItemText>{t('controls.normalMode')}</ListItemText>
                    </ListItemButton>
                </ListItem>
                <ListItem onClick={() => onPlayMode(PlayMode.condensed)}>
                    <ListItemButton selected={selectedPlayModes.has(PlayMode.condensed)}>
                        <ListItemText>{t('controls.condensedMode')}</ListItemText>
                    </ListItemButton>
                </ListItem>
                <ListItem onClick={() => onPlayMode(PlayMode.fastForward)}>
                    <ListItemButton selected={selectedPlayModes.has(PlayMode.fastForward)}>
                        <ListItemText>{t('controls.fastForwardMode')}</ListItemText>
                    </ListItemButton>
                </ListItem>
                <ListItem onClick={() => onPlayMode(PlayMode.autoPause)}>
                    <ListItemButton selected={selectedPlayModes.has(PlayMode.autoPause)}>
                        <ListItemText>{t('controls.autoPauseMode')}</ListItemText>
                    </ListItemButton>
                </ListItem>
                <ListItem onClick={() => onPlayMode(PlayMode.repeat)}>
                    <ListItemButton selected={selectedPlayModes.has(PlayMode.repeat)}>
                        <ListItemText>{t('controls.repeatMode')}</ListItemText>
                    </ListItemButton>
                </ListItem>
            </List>
        </Popover>
    );
}
