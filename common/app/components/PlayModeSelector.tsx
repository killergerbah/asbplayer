import React from 'react';
import { useTranslation } from 'react-i18next';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Popover from '@material-ui/core/Popover';
import { PlayMode } from '@project/common';

interface Props {
    open: boolean;
    anchorEl?: Element;
    selectedPlayMode?: PlayMode;
    onPlayMode: (playMode: PlayMode) => void;
    onClose: () => void;
}

export default function PlayModeSelector({ open, anchorEl, selectedPlayMode, onPlayMode, onClose }: Props) {
    const { t } = useTranslation();

    return (
        <div>
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
            >
                <List>
                    <ListItem
                        selected={selectedPlayMode === PlayMode.normal}
                        button
                        onClick={(e) => onPlayMode(PlayMode.normal)}
                    >
                        {t('controls.normalMode')}
                    </ListItem>
                    <ListItem
                        selected={selectedPlayMode === PlayMode.condensed}
                        button
                        onClick={(e) => onPlayMode(PlayMode.condensed)}
                    >
                        {t('controls.condensedMode')}
                    </ListItem>
                    <ListItem
                        selected={selectedPlayMode === PlayMode.fastForward}
                        button
                        onClick={(e) => onPlayMode(PlayMode.fastForward)}
                    >
                        {t('controls.fastForwardMode')}
                    </ListItem>
                    <ListItem
                        selected={selectedPlayMode === PlayMode.autoPause}
                        button
                        onClick={(e) => onPlayMode(PlayMode.autoPause)}
                    >
                        {t('controls.autoPauseMode')}
                    </ListItem>
                </List>
            </Popover>
        </div>
    );
}
