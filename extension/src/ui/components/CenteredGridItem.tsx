import Grid from '@material-ui/core/Grid';

import React from 'react';

const CenteredGridItem = ({ children, ...props }: { children: React.ReactNode }) => {
    return (
        <Grid style={{ textAlign: 'center' }} {...props}>
            {children}
        </Grid>
    );
};

export default CenteredGridItem;
