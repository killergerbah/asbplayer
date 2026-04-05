import React from 'react';
import MuiDrawer, { type DrawerProps } from '@mui/material/Drawer';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface Props extends DrawerProps {
    children: React.ReactNode;
    showBackButton: boolean;
    drawerWidth?: number;
    onClose: () => void;
}

const Drawer: React.FC<Props> = ({ children, showBackButton, onClose, drawerWidth, ...rest }) => {
    const width = drawerWidth === undefined ? '100%' : drawerWidth;

    return (
        <MuiDrawer
            variant="persistent"
            anchor="right"
            sx={{
                maxHeight: '100%',
            }}
            slotProps={{
                paper: { sx: { width } },
            }}
            {...rest}
        >
            {showBackButton && (
                <Paper square>
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
