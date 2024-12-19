import type { InputProps } from '@material-ui/core/Input';
import { MutableRefObject } from 'react';
import VideoControlInput from './VideoControlInput';

interface Props extends InputProps {
    inputRef: MutableRefObject<HTMLInputElement | undefined>;
    offset: number;
    onOffset: (offset: number) => void;
    disableKeyEvents?: boolean;
}

const valueToPrettyString = (v: number) => {
    const offsetSeconds = v / 1000;
    return offsetSeconds >= 0 ? '+' + offsetSeconds.toFixed(2) : String(offsetSeconds.toFixed(2));
};
const stringToValue = (s: string) => Number(s) * 1000;
const placeholder = '±' + Number(0).toFixed(2);

export default function SubtitleOffsetInput({ inputRef, offset, onOffset, ...rest }: Props) {
    return (
        <VideoControlInput
            inputRef={inputRef}
            defaultNumberValue={0}
            valueToPrettyString={valueToPrettyString}
            stringToValue={stringToValue}
            numberValue={offset}
            onNumberValue={onOffset}
            placeholder={placeholder}
            {...rest}
        />
    );
}
