import { useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import MuiAlert from '@material-ui/lab/Alert';
import Grow from '@material-ui/core/Grow';

const useAlertStyles = makeStyles({
    root: {
        display: 'flex',
        justifyContent: 'center',
        position: 'fixed',
        top: 80,
        width: '100%',
        pointerEvents: 'none',
        zIndex: 2000,
    },
});

export default function Alert(props) {
    const classes = useAlertStyles();

    useEffect(() => {
        if (props.open) {
            const timeout = setTimeout(props.onClose, props.autoHideDuration);
            return () => clearTimeout(timeout);
        }

        return null;
    }, [props.open, props.autoHideDuration, props.onClose]);

    return (
        <div className={classes.root}>
            <Grow in={props.open}>
                <MuiAlert severity={props.severity}>{props.children}</MuiAlert>
            </Grow>
        </div>
    );
}
