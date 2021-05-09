import { makeStyles } from '@material-ui/styles';
import Fade from '@material-ui/core/Fade';
import coloredBackground from './background-colored.png';

const useStyles = makeStyles((theme) => ({
    root: ({dragging}) => ({
        position: "absolute",
        height: "calc(100% - 64px)",
        width: "100%",
        zIndex: 101,
        pointerEvents: dragging ? "auto" : "none"
    }),
    transparentBackground: {
        "&::before": {
            content: "' '",
            position: "absolute",
            height: 'calc(100vh - 64px)',
            width: "100%",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: 15,
            textAlign: "center",
            backgroundSize: "500px 500px",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            backgroundImage: `url(${coloredBackground})`,
            opacity: 0.3
        }
    }
}));

export default function DragOverlay({dragging}) {
    const classes = useStyles({dragging: dragging});

    return (
        <div className={classes.root}>
            <Fade in={dragging}>
                <div className={classes.transparentBackground} />
            </Fade>
        </div>
    );
}
