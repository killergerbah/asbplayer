import MuiTooltip, { TooltipProps } from '@mui/material/Tooltip';

interface ControllableTooltipProps extends TooltipProps {
    disabled: boolean;
}

const Tooltip = ({ children, disabled, ...rest }: ControllableTooltipProps) => {
    if (disabled) {
        return children;
    }

    return <MuiTooltip {...rest}>{children}</MuiTooltip>;
};

export default Tooltip;
