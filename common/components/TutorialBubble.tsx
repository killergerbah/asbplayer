import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@project/common/components/Tooltip';

export interface TutorialBubbleProps {
    placement: 'left' | 'right' | 'top' | 'bottom' | 'bottom-start';
    disableArrow?: boolean;
    text: React.ReactElement | string;
    show?: boolean;
    children: React.ReactElement;
    disabled?: boolean;
    onConfirm?: () => void;
}

const TutorialBubble: React.FC<TutorialBubbleProps> = ({
    disabled,
    placement,
    disableArrow,
    show,
    onConfirm,
    text,
    children,
}) => {
    return (
        <Tooltip
            disabled={disabled}
            arrow={disableArrow !== true}
            placement={placement}
            open={show}
            slotProps={{
                popper: {
                    sx: { pointerEvents: 'auto' },
                },
            }}
            title={
                <Stack spacing={1} sx={{ margin: 0.5, marginBottom: 0.75 }}>
                    <Typography variant="subtitle1">{text}</Typography>
                    {onConfirm && (
                        // TODO localize
                        <Button variant="contained" onClick={onConfirm} fullWidth>
                            Got it
                        </Button>
                    )}
                </Stack>
            }
        >
            {children}
        </Tooltip>
    );
};

export default TutorialBubble;
