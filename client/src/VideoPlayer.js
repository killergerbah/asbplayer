import { useCallback, useEffect, useMemo, useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles({
    root: {
        backgroundColor: 'black',
        width: '100%',
        height: '100vh'
    },
    video: {
        objectFit: "cover",
        position: "absolute",
        width: "auto",
        height: "100%"
    }
});

export default function VideoPlayer(props) {
    const classes = useStyles();
    const { videoFile, channel } = useMemo(() => {
        const params = new URLSearchParams(window.location.search);
        return {
            videoFile: params.get('video'),
            channel: params.get('channel')
        };
    }, []);
    const broadcastChannelRef = useRef(new BroadcastChannel(channel));
    const videoRef = useRef(null);
    const videoRefCallback = useCallback(element => {
        if (element) {
            videoRef.current = element;

            function publishReady(duration) {
                broadcastChannelRef.current.postMessage({command: 'ready', duration: duration});
            }

            if (element.duration) {
                publishReady(element.duration);
            } else {
                element.onloadeddata = (event) => {
                    // https://stackoverflow.com/questions/10385768/how-do-you-resize-a-browser-window-so-that-the-inner-width-is-a-specific-value
                    if (window.outerWidth) {
                        const desiredWidth = element.videoWidth + (window.outerWidth - window.innerWidth);
                        const desiredHeight = element.videoHeight + (window.outerHeight - window.innerHeight);
                        const resizeRatio = Math.min(window.screen.width / desiredWidth, window.screen.height / desiredHeight);

                        window.resizeTo(
                            resizeRatio * desiredWidth,
                            resizeRatio * desiredHeight
                        );
                    }

                    publishReady(element.duration);
                };
            }
        }
    }, []);

    useEffect(() => {
        broadcastChannelRef.current.onmessage = function(event) {
            if (!videoRef.current) {
                return;
            }

            switch (event.data.command) {
                case "play":
                    videoRef.current.play();
                    break;
                case "pause":
                    videoRef.current.pause();
                    break;
                case "currentTime":
                    videoRef.current.currentTime = event.data.value;
                    break;
                case "close":
                    broadcastChannelRef.current.close();
                    broadcastChannelRef.current = null;
                    window.close();
                    break;
                default:
                    console.error("Unrecognized event " + event.data.command);
            }
        };

        return () => {
            if (broadcastChannelRef.current) {
                broadcastChannelRef.current.close();
                broadcastChannelRef.current = null;
            }
        }
    }, []);

    return (
        <div className={classes.root}>
            <video className={classes.video} nocontrols={1} ref={videoRefCallback} src={props.api.streamingUrl(videoFile)} />
        </div>
    );
}