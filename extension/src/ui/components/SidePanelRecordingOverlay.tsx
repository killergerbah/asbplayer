import { makeStyles } from '@mui/styles';
import Box from '@mui/material/Box';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

interface Props {
    show: boolean;
}

const useStyles = makeStyles(() => ({
    icon: {
        animation: `$blink infinite 1s`,
    },
    '@keyframes blink': {
        '0%': { opacity: 1 },
        '100%': { opacity: 0 },
    },
}));

const SidePanelRecordingOverlay = ({ show }: Props) => {
    const classes = useStyles();

    if (!show) {
        return null;
    }

    return (
        <Box padding={1} style={{ position: 'absolute', top: 0, left: 0 }}>
            <FiberManualRecordIcon className={classes.icon} color="error" />
        </Box>
    );
};

export default SidePanelRecordingOverlay;
