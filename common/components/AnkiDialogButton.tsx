import type { ButtonBaseActions } from '@material-ui/core';
import Button, { ButtonProps } from '@material-ui/core/Button';
import React, { ForwardedRef, useCallback, useEffect, useRef, useState } from 'react';

interface Props extends ButtonProps {
    focusVisible: boolean;
    onBlurVisible: () => void;
}

export default React.forwardRef(function AnkiDialogButton(
    { children, focusVisible, onBlurVisible, ...rest }: Props,
    ref: ForwardedRef<HTMLButtonElement>
) {
    const actionRef = useRef<ButtonBaseActions | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const [rendered, setRendered] = useState<boolean>(false);

    const focusOnButton = useCallback(() => {
        // There's a bug in MUIv4 where focusVisible can throw an exception if called too early.
        // To ensure this doesn't happen we make sure the touch ripple element exists before calling it.
        if (buttonRef.current?.querySelector('.MuiTouchRipple-root')) {
            actionRef.current?.focusVisible();
            return true;
        }

        return false;
    }, []);

    const focusOnButtonEventually = useCallback(() => {
        if (!buttonRef.current) {
            return () => {};
        }

        if (focusOnButton()) {
            return () => {};
        }

        let disconnected = false;

        const observer = new MutationObserver((mutations) => {
            const touchRipple = mutations
                .filter((m) => m.type === 'childList')
                .flatMap((m) => [...m.addedNodes])
                .filter((n) => n instanceof HTMLElement)
                .find((n) => (n as HTMLElement).classList.contains('MuiTouchRipple-root'));

            if (touchRipple) {
                observer.disconnect();
                disconnected = true;
                focusOnButton();
            }
        });

        observer.observe(buttonRef.current, { childList: true });

        return () => {
            if (!disconnected) {
                observer.disconnect();
            }
        };
    }, [focusOnButton]);

    useEffect(() => {
        if (focusVisible && rendered) {
            focusOnButtonEventually();
        }
    }, [focusVisible, focusOnButtonEventually, rendered]);

    const refCallback = useCallback(
        (element: HTMLButtonElement | null) => {
            if (ref) {
                if (typeof ref === 'function') {
                    ref(element);
                } else {
                    ref.current = element;
                }

                buttonRef.current = element;
            }

            setRendered(element !== null);
        },
        [ref]
    );

    const handleBlur = useCallback(() => onBlurVisible(), [onBlurVisible]);

    return (
        <Button ref={refCallback} onBlur={handleBlur} action={actionRef} {...rest}>
            {children}
        </Button>
    );
});
