import Input from '@material-ui/core/Input';
import React, { MutableRefObject, useCallback, useEffect, useState } from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { useTranslation } from 'react-i18next';

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

interface Props {
    inputRef: MutableRefObject<HTMLInputElement | undefined>;
    offset: number;
    onOffset: (offset: number) => void;
    disableKeyEvents?: boolean;
}

export default function SubtitleOffsetInput({ inputRef, offset, onOffset, disableKeyEvents }: Props) {
    const { t } = useTranslation();
    const classes = useStyles();
    const [offsetInputWidth, setOffsetInputWidth] = useState<number>(5);
    const handleNumberInputClicked = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
        const inputElement = e.target as HTMLInputElement;
        inputElement.setSelectionRange(0, inputElement.value?.length || 0);
    }, []);

    const updateOffset = useCallback(
        (offset: number) => {
            if (!inputRef.current) {
                return;
            }

            if (offset === 0) {
                inputRef.current.value = '';
                setOffsetInputWidth(5);
            } else {
                const offsetSeconds = offset / 1000;
                const value = offsetSeconds >= 0 ? '+' + offsetSeconds.toFixed(2) : String(offsetSeconds.toFixed(2));
                inputRef.current.value = value;
                setOffsetInputWidth(value.length);
            }

            inputRef.current.blur();
        },
        [inputRef]
    );

    const tryApplyOffset = useCallback(
        (revertOnFailure: boolean) => {
            if (!inputRef.current) {
                return;
            }

            const newOffset = Number(inputRef.current.value) * 1000;

            if (newOffset === offset) {
                updateOffset(offset);
                return;
            }

            if (Number.isNaN(newOffset)) {
                if (revertOnFailure) {
                    updateOffset(offset);
                }
                return;
            }

            onOffset(newOffset);
        },
        [updateOffset, onOffset, offset, inputRef]
    );

    const handleNumberInputDeselected = useCallback(() => {
        tryApplyOffset(true);
    }, [tryApplyOffset]);

    useEffect(() => {
        updateOffset(offset);
    }, [offset, updateOffset]);

    useEffect(() => {
        if (disableKeyEvents) {
            return;
        }

        function handleKey(event: KeyboardEvent) {
            if (event.key === 'Enter' && inputRef.current !== null && inputRef.current === document.activeElement) {
                tryApplyOffset(false);
            }
        }

        window.addEventListener('keydown', handleKey);

        return () => {
            window.removeEventListener('keydown', handleKey);
        };
    }, [tryApplyOffset, disableKeyEvents, inputRef]);

    return (
        <Input
            style={{
                width: `${offsetInputWidth}ch`,
            }}
            inputRef={inputRef}
            disableUnderline={true}
            className={classes.input}
            placeholder={'±' + Number(0).toFixed(2)}
            onClick={handleNumberInputClicked}
            onBlur={handleNumberInputDeselected}
            onChange={(e) => setOffsetInputWidth(Math.max(5, e.target.value.length))}
        />
    );
}
