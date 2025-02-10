import type { InputProps } from '@mui/material/Input';
import React, { MutableRefObject } from 'react';
import VideoControlInput from './VideoControlInput';

interface Props extends InputProps {
    inputRef: MutableRefObject<HTMLInputElement | undefined>;
    playbackRate: number;
    onPlaybackRate: (playbackRate: number) => void;
    disableKeyEvents?: boolean;
}

const valueToPrettyString = (v: number) => '×' + String(v.toFixed(2));
const stringToValue = (s: string) => Number(s);
const rejectValue = (v: number) => v < 0.1 || v > 5;
const placeholder = '×' + Number(1).toFixed(2);

export default React.forwardRef(function PlaybackRateInput(
    { inputRef, playbackRate, onPlaybackRate, ...rest }: Props,
    ref
) {
    return (
        <VideoControlInput
            ref={ref}
            inputRef={inputRef}
            defaultNumberValue={1}
            valueToPrettyString={valueToPrettyString}
            stringToValue={stringToValue}
            numberValue={playbackRate}
            onNumberValue={onPlaybackRate}
            rejectValue={rejectValue}
            placeholder={placeholder}
            {...rest}
        />
    );
});
