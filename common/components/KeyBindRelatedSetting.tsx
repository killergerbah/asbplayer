import React from 'react';
import Grid2 from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import { type Theme, useTheme } from '@mui/material/styles';

interface Props {
    label: React.ReactNode;
    control: React.ReactNode;
}

export default function KeyBindRelatedSetting({ label, control }: Props) {
    const theme = useTheme<Theme>();
    return (
        <Grid2 container wrap="nowrap" spacing={1} sx={{ '&:hover': { background: theme.palette.action.hover }, p: 1 }}>
            <Grid2 size={7.5}>
                <Typography>{label}</Typography>
            </Grid2>
            <Grid2 size="grow" sx={{ textAlign: 'right' }}>
                {control}
            </Grid2>
        </Grid2>
    );
}
