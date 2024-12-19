import Input, { InputProps } from '@material-ui/core/Input';
import React, { MutableRefObject, useCallback, useEffect, useState } from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';

const useStyles = makeStyles({
    input: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        fontSize: 20,
        marginLeft: 10,
        width: 100,
        color: '#fff',
        pointerEvents: 'auto',
    },
});

interface Props extends InputProps {
    inputRef: MutableRefObject<HTMLInputElement | undefined>;
    numberValue: number;
    defaultNumberValue: number;
    onNumberValue: (value: number) => void;
    valueToPrettyString: (value: number) => string;
    stringToValue: (stringValue: string) => number;
    rejectValue?: (value: number) => boolean;
    disableKeyEvents?: boolean;
}

export default function VideoControlInput({
    inputRef,
    numberValue,
    defaultNumberValue,
    onNumberValue,
    valueToPrettyString,
    stringToValue,
    rejectValue,
    disableKeyEvents,
    className,
    ...rest
}: Props) {
    const classes = useStyles();
    const [inputWidth, setInputWidth] = useState<number>(5);
    const handleNumberInputClicked = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
        const inputElement = e.target as HTMLInputElement;
        inputElement.setSelectionRange(0, inputElement.value?.length || 0);
    }, []);

    const updateValue = useCallback(
        (value: number) => {
            if (!inputRef.current) {
                return;
            }

            if (value === defaultNumberValue) {
                inputRef.current.value = '';
                setInputWidth(5);
            } else {
                onNumberValue(value);
                const stringValue = valueToPrettyString(value);
                inputRef.current.value = stringValue;
                setInputWidth(stringValue.length);
            }

            inputRef.current.blur();
        },
        [inputRef, valueToPrettyString, onNumberValue, defaultNumberValue]
    );

    const tryApplyValue = useCallback(
        (revertOnFailure: boolean) => {
            if (!inputRef.current) {
                return;
            }

            const newValue = stringToValue(inputRef.current.value);

            if (newValue === numberValue) {
                updateValue(numberValue);
                return;
            }

            if (Number.isNaN(newValue) || rejectValue?.(newValue)) {
                if (revertOnFailure) {
                    updateValue(numberValue);
                }
                return;
            }

            onNumberValue(newValue);
        },
        [updateValue, stringToValue, onNumberValue, rejectValue, numberValue, inputRef]
    );

    const handleNumberInputDeselected = useCallback(() => {
        tryApplyValue(true);
    }, [tryApplyValue]);

    useEffect(() => {
        updateValue(numberValue);
    }, [numberValue, updateValue]);

    useEffect(() => {
        if (disableKeyEvents) {
            return;
        }

        function handleKey(event: KeyboardEvent) {
            if (event.key === 'Enter' && inputRef.current !== null && inputRef.current === document.activeElement) {
                tryApplyValue(false);
            }
        }

        window.addEventListener('keydown', handleKey);

        return () => {
            window.removeEventListener('keydown', handleKey);
        };
    }, [tryApplyValue, disableKeyEvents, inputRef]);

    const actualClassName = className ? `${className} ${classes.input}` : classes.input;

    return (
        <Input
            style={{
                width: `${inputWidth}ch`,
            }}
            inputRef={inputRef}
            disableUnderline={true}
            className={actualClassName}
            onClick={handleNumberInputClicked}
            onBlur={handleNumberInputDeselected}
            onChange={(e) => setInputWidth(Math.max(5, e.target.value.length))}
            {...rest}
        />
    );
}
