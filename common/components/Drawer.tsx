import React from 'react';
import MuiDrawer, { type DrawerProps } from '@mui/material/Drawer';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useAppBarHeight } from '../hooks/use-app-bar-height';

interface Props extends DrawerProps {
    children: React.ReactNode;
    showBackButton: boolean;
    drawerWidth?: number;
    onClose: () => void;
}

const Drawer: React.FC<Props> = ({ children, showBackButton, onClose, drawerWidth, ...rest }) => {
    const width = drawerWidth === undefined ? '100%' : drawerWidth;
    const appBarHeight = useAppBarHeight();

    return (
        <MuiDrawer
            variant="persistent"
            anchor="right"
            sx={{
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
            }}
            slotProps={{
                paper: { sx: { width } },
            }}
            {...rest}
        >
            {showBackButton && (
                <Paper
                    square
                    sx={{
                        height: appBarHeight === 0 ? 'auto' : appBarHeight,
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'start',
                        pl: 1,
                    }}
                >
                    <IconButton onClick={onClose}>
                        <ChevronRightIcon />
                    </IconButton>
                </Paper>
            )}
            {children}
        </MuiDrawer>
    );
};

export default Drawer;
