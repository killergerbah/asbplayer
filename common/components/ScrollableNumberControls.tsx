import makeStyles from '@material-ui/core/styles/makeStyles';
import PlaybackRateInput from './PlaybackRateInput';
import SubtitleOffsetInput from './SubtitleOffsetInput';
import TimeDisplay from './TimeDisplay';
import { MutableRefObject, useCallback, useRef, useState } from 'react';

const containerHeight = 48;
const scrollThreshold = containerHeight / 2 + 1;

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
    const containerRef = useRef<HTMLDivElement>();
    const programmaticallyScrollingTimeoutRef = useRef<NodeJS.Timeout>();
    const controlTypeRef = useRef<number>(controlType);
    controlTypeRef.current = controlType;

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

    const handleWheel = useCallback((e: WheelEvent) => {
        if (programmaticallyScrollingTimeoutRef.current !== undefined) {
            // Programmatic scroll already started
            e.preventDefault();
            return;
        }

        if (Number.isInteger(e.deltaY) || e.deltaX !== 0 || Math.abs(e.deltaY) < 1) {
            // Probably from a touchpad, let this through
            return;
        }

        // Only allow programmatic scroll to the next control
        e.preventDefault();

        const goingDown = e.deltaY > 0;
        let didProgrammaticallyScroll = false;

        if (goingDown && controlTypeRef.current < 2) {
            containerRef.current?.scrollBy({ top: scrollThreshold, behavior: 'smooth' });
            didProgrammaticallyScroll = true;
        } else if (!goingDown && controlTypeRef.current > 0) {
            containerRef.current?.scrollBy({ top: -scrollThreshold, behavior: 'smooth' });
            didProgrammaticallyScroll = true;
        }

        if (didProgrammaticallyScroll) {
            if (programmaticallyScrollingTimeoutRef.current !== undefined) {
                clearTimeout(programmaticallyScrollingTimeoutRef.current);
            }

            // Ensure the scrolling flag is reset so that we don't block all wheel operations
            programmaticallyScrollingTimeoutRef.current = setTimeout(() => {
                programmaticallyScrollingTimeoutRef.current = undefined;
            }, 500);
        }
    }, []);

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
                div.addEventListener('wheel', handleWheel, { passive: false });
                div.addEventListener('scrollend', () => {
                    programmaticallyScrollingTimeoutRef.current = undefined;
                });
                containerRef.current = div;
            }
        },
        [initialScroll, handleWheel]
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
