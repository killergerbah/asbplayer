import React from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import { Theme } from '@mui/material/styles';

const useStyles = makeStyles((theme: Theme) => ({
    container: {
        marginBottom: theme.spacing(1),
    },
    labelItem: {
        marginTop: theme.spacing(1),
    },
}));

interface Props {
    label: React.ReactNode;
    control: React.ReactNode;
}

export default function KeyBindRelatedSetting({ label, control }: Props) {
    const classes = useStyles();

    return (
        <Grid container className={classes.container} wrap="nowrap" spacing={1}>
            <Grid item className={classes.labelItem} xs={12}>
                <Typography>{label}</Typography>
            </Grid>
            <Grid item xs={6}>
                {control}
            </Grid>
        </Grid>
    );
}
