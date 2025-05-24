import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@project/common/components/Tooltip';

interface BubbleProps {
    placement: 'left' | 'right' | 'top' | 'bottom';
    text: React.ReactElement | string;
    show?: boolean;
    children: React.ReactElement;
    onConfirm?: () => void;
}

const TutorialBubble: React.FC<BubbleProps> = ({ placement, show, onConfirm, text, children }) => {
    return (
        <Tooltip
            arrow
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
