import { makeStyles } from '@material-ui/core/styles';

function displayTime(milliseconds: number) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const secondsInMinute = seconds % 60;
    return String(minutes) + ':' + String(secondsInMinute).padStart(2, '0');
}

const useStyles = makeStyles({
    timeDisplay: {
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: '100%',
        cursor: 'default',
        fontSize: 20,
        marginLeft: 10,
        whiteSpace: 'nowrap',
    },
});

interface Props {
    currentMilliseconds: number;
    totalMilliseconds: number;
}

const TimeDisplay = ({ currentMilliseconds, totalMilliseconds }: Props) => {
    const classes = useStyles();

    return (
        <div className={classes.timeDisplay}>
            {displayTime(currentMilliseconds)} / {displayTime(totalMilliseconds)}
        </div>
    );
};

export default TimeDisplay;
