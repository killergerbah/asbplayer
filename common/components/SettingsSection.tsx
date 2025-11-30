import React from 'react';
import Typography from '@mui/material/Typography';

const SettingsSection: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <Typography variant="h5" sx={{ fontWeight: 'bold', pb: 0.5, pt: 1 }}>
            {children}
        </Typography>
    );
};

export default SettingsSection;
