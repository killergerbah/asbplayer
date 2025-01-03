import makeStyles from '@material-ui/core/styles/makeStyles';
import PlaybackRateInput from './PlaybackRateInput';
import SubtitleOffsetInput from './SubtitleOffsetInput';
import TimeDisplay from './TimeDisplay';
import { MutableRefObject, useCallback, useRef, useState } from 'react';

const containerHeight = 48;

const useStyles = makeStyles({
    container: {
        height: containerHeight,
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': {
            display: 'none',
        },
        textAlign: 'center',
        scrollBehavior: 'smooth',
    },
    child: {
        scrollbarWidth: 'none',
        scrollSnapAlign: 'center',
        '&::-webkit-scrollbar': {
            display: 'none',
        },
        scrollSnapStop: 'always',
    },
});

export enum ControlType {
    timeDisplay = 0,
    subtitleOffset = 1,
    playbackRate = 2,
}

interface Props {
    offset: number;
    currentMilliseconds: number;
    totalMilliseconds?: number;
    playbackRate: number;
    offsetInputRef: MutableRefObject<HTMLInputElement | undefined>;
    onOffset: (offset: number) => void;
    playbackRateInputRef: MutableRefObject<HTMLInputElement | undefined>;
    onPlaybackRate: (playbackRate: number) => void;
    onScrollTo: (controlType: ControlType) => void;
}

const ScrollableNumberControls = ({
    currentMilliseconds,
    totalMilliseconds,
    offset,
    offsetInputRef,
    onOffset,
    playbackRate,
    playbackRateInputRef,
    onPlaybackRate,
    onScrollTo,
}: Props) => {
    const classes = useStyles();
    const [controlType, setControlType] = useState<ControlType>(ControlType.timeDisplay);
    const lastScrollTop = useRef<number>(0);
    const [initialScroll, setInitialScrolll] = useState<boolean>(false);

    const handleScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const currentScrollTop = e.currentTarget.scrollTop;
            const goingDown = currentScrollTop > lastScrollTop.current;
            const newControlType = goingDown
                ? Math.ceil(Math.floor(currentScrollTop) / containerHeight)
                : Math.floor(currentScrollTop / containerHeight);

            if (newControlType !== controlType) {
                onScrollTo(newControlType);
                setControlType(newControlType);
            }

            lastScrollTop.current = currentScrollTop;
        },
        [onScrollTo, controlType]
    );

    const handleDivRef = useCallback(
        (div: HTMLDivElement) => {
            if (initialScroll) {
                return;
            }

            if (div) {
                setTimeout(() => {
                    div.scrollTop = containerHeight * 2;
                    div.scroll({ top: 0, behavior: 'smooth' });
                    setInitialScrolll(true);
                }, 0);
            }
        },
        [initialScroll]
    );

    return (
        <div ref={handleDivRef} onScroll={handleScroll} className={classes.container}>
            <TimeDisplay
                currentMilliseconds={currentMilliseconds}
                totalMilliseconds={totalMilliseconds}
                className={classes.child}
            />
            <SubtitleOffsetInput
                inputRef={offsetInputRef}
                offset={offset}
                onOffset={onOffset}
                className={classes.child}
            />
            <PlaybackRateInput
                inputRef={playbackRateInputRef}
                playbackRate={playbackRate}
                onPlaybackRate={onPlaybackRate}
                className={classes.child}
            />
        </div>
    );
};

export default ScrollableNumberControls;
