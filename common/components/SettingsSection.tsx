import React from 'react';
import Typography from '@mui/material/Typography';

interface Props {
    children: React.ReactNode;
}

const SettingsSection = React.forwardRef<HTMLSpanElement, Props>(function SettingsSection({ children }, ref) {
    return (
        <Typography ref={ref} variant="h5" sx={{ fontWeight: 'bold', pb: 0.5, pt: 1 }}>
            {children}
        </Typography>
    );
});

export default SettingsSection;
