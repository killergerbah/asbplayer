import React from 'react';
import { useTranslation } from 'react-i18next';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Popover from '@material-ui/core/Popover';
import type { PopoverProps } from '@material-ui/core/Popover';
import { PlayMode } from '@project/common';

interface Props extends PopoverProps {
    open: boolean;
    listStyle?: React.CSSProperties;
    anchorEl?: Element;
    selectedPlayMode?: PlayMode;
    onPlayMode: (playMode: PlayMode) => void;
    onClose: () => void;
}

export default function PlayModeSelector({
    listStyle,
    selectedPlayMode,
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
            <List style={listStyle}>
                <ListItem
                    dense
                    selected={selectedPlayMode === PlayMode.normal}
                    button
                    onClick={(e) => onPlayMode(PlayMode.normal)}
                >
                    {t('controls.normalMode')}
                </ListItem>
                <ListItem
                    dense
                    selected={selectedPlayMode === PlayMode.condensed}
                    button
                    onClick={(e) => onPlayMode(PlayMode.condensed)}
                >
                    {t('controls.condensedMode')}
                </ListItem>
                <ListItem
                    dense
                    selected={selectedPlayMode === PlayMode.fastForward}
                    button
                    onClick={(e) => onPlayMode(PlayMode.fastForward)}
                >
                    {t('controls.fastForwardMode')}
                </ListItem>
                <ListItem
                    dense
                    selected={selectedPlayMode === PlayMode.autoPause}
                    button
                    onClick={(e) => onPlayMode(PlayMode.autoPause)}
                >
                    {t('controls.autoPauseMode')}
                </ListItem>
                <ListItem
                    dense
                    selected={selectedPlayMode === PlayMode.repeat}
                    button
                    onClick={(e) => onPlayMode(PlayMode.repeat)}
                >
                    {t('controls.repeatMode')}
                </ListItem>
            </List>
        </Popover>
    );
}
