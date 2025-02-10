import { makeStyles } from '@mui/styles';

function displayTime(milliseconds: number) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const secondsInMinute = seconds % 60;
    return String(minutes) + ':' + String(secondsInMinute).padStart(2, '0');
}

const useStyles = makeStyles(() => ({
    timeDisplay: {
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: '100%',
        cursor: 'default',
        fontSize: 20,
        whiteSpace: 'nowrap',
    },
}));

interface Props extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    currentMilliseconds: number;
    totalMilliseconds?: number;
}

const TimeDisplay = ({ currentMilliseconds, totalMilliseconds, className, ...rest }: Props) => {
    const classes = useStyles();
    const actualClassName = className ? `${className} ${classes.timeDisplay}` : classes.timeDisplay;
    const content =
        totalMilliseconds === undefined
            ? displayTime(currentMilliseconds)
            : `${displayTime(currentMilliseconds)} / ${displayTime(totalMilliseconds)}`;
    return (
        <div className={actualClassName} {...rest}>
            {`\n\n${content}\n\n`}
        </div>
    );
};

export default TimeDisplay;
