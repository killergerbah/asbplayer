import MuiTooltip, { TooltipProps } from '@material-ui/core/Tooltip';
import React from 'react';

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
