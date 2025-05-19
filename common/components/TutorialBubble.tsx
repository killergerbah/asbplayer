import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@project/common/components/Tooltip';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();
    return (
        <Tooltip
            disabled={disabled}
            arrow={disableArrow !== true}
            placement={placement}
            open={show}
            slotProps={{
                popper: {
                    sx: { pointerEvents: 'auto', zIndex: 2147483648 },
                },
            }}
            title={
                <Stack spacing={1} sx={{ margin: 0.5, marginBottom: 0.75 }}>
                    <Typography variant="subtitle1">{text}</Typography>
                    {onConfirm && (
                        <Button variant="contained" onClick={onConfirm} fullWidth>
                            {t('action.gotIt')}
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
