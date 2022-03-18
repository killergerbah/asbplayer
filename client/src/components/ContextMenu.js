import { Menu, MenuItem } from '@material-ui/core';
import React, { useState } from 'react';

export default function ContextMenuWrapper({ menuItems, disabled, children }) {
    const [anchorEl, setAnchorEl] = useState(null);
    const [styles, setStyles] = useState(undefined);
    const open = Boolean(anchorEl);

    const screenH = window.innerHeight;

    const handleClose = () => {
        setAnchorEl(null);
    };
    const handleContexMenu = (e) => {
        e.preventDefault();
        setAnchorEl(null);

        const anchor = e.currentTarget;
        setStyles({ top: e.pageY - screenH / 2, left: e.pageX });
        setAnchorEl(anchor);
    };

    const handleClick = (clickHandler) => {
        handleClose();
        setTimeout(clickHandler, 100); // Give menu the chance to close
    };

    return (
        <>
            {disabled ? (
                <>{children}</>
            ) : (
                <div onContextMenu={handleContexMenu}>
                    {children}
                    <Menu
                        id="basic-menu"
                        anchorEl={anchorEl}
                        open={open}
                        onClose={handleClose}
                        MenuListProps={{
                            'aria-labelledby': 'basic-button',
                        }}
                        style={{ ...styles, position: 'fixed' }}
                    >
                        {menuItems.map(({ label, onClick }) => (
                            <MenuItem onClick={() => handleClick(onClick)}>{label}</MenuItem>
                        ))}
                    </Menu>
                </div>
            )}{' '}
        </>
    );
}
