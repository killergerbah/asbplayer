import React, { useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import MuiAlert, { Color } from '@material-ui/lab/Alert';
import Grow from '@material-ui/core/Grow';

const useAlertStyles = makeStyles({
    root: {
        display: 'flex',
        justifyContent: 'center',
        position: 'fixed',
        width: '100%',
        pointerEvents: 'none',
        zIndex: 2000,
    },
    bottom: {
        bottom: '10vh',
    },
    top: {
        top: '10vh',
    },
});

interface Props {
    open: boolean;
    autoHideDuration: number;
    onClose: () => void;
    severity: Color | undefined;
    disableAutoHide?: boolean;
    anchor?: 'top' | 'bottom';
    children: React.ReactNode;
}

export default function Alert(props: Props) {
    const classes = useAlertStyles();

    useEffect(() => {
        if (props.open && !props.disableAutoHide) {
            const timeout = setTimeout(props.onClose, props.autoHideDuration);
            return () => clearTimeout(timeout);
        }
    }, [props.open, props.autoHideDuration, props.disableAutoHide, props.onClose]);
    const anchorClass = props.anchor === 'bottom' ? classes.bottom : classes.top;
    return (
        <div className={`${classes.root} ${anchorClass}`}>
            <Grow in={props.open}>
                <MuiAlert severity={props.severity}>{props.children}</MuiAlert>
            </Grow>
        </div>
    );
}
