import React from 'react';
import { makeStyles } from '@material-ui/styles';
import Fade from '@material-ui/core/Fade';
import { Theme } from '@material-ui/core';

interface StylesProps {
    dragging: boolean;
    appBarHidden: boolean;
    logoUrl: string;
}

interface Props {
    dragging: boolean;
    appBarHidden: boolean;
    loading: boolean;
    logoUrl: string;
}

const useStyles = makeStyles<Theme, StylesProps>((theme) => ({
    root: ({ dragging, appBarHidden }) => ({
        position: 'absolute',
        height: appBarHidden ? '100%' : 'calc(100% - 64px)',
        width: '100%',
        zIndex: 101,
        pointerEvents: dragging ? 'auto' : 'none',
    }),
    transparentBackground: ({ appBarHidden, logoUrl }) => ({
        '&::before': {
            content: "' '",
            position: 'absolute',
            height: appBarHidden ? '100vh' : 'calc(100vh - 64px)',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            backgroundSize: '300px 300px',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundImage: `url(${logoUrl})`,
            backgroundBlendMode: 'overlay',
            background: 'rgba(0, 0, 0, .3)',
            filter: 'drop-shadow(10px 10px 10px rgb(0, 0, 0, .4))',
        },
        width: '100%',
        height: '100%',
    }),
}));

export default function DragOverlay({ dragging, appBarHidden, loading, logoUrl }: Props) {
    const classes = useStyles({ dragging, appBarHidden, logoUrl });

    return (
        <div className={classes.root}>
            <Fade in={dragging || loading}>
                <div className={classes.transparentBackground} />
            </Fade>
        </div>
    );
}
