import Grid, { GridProps } from '@material-ui/core/Grid';

import React from 'react';

const CenteredGridItem = ({ children, ...props }: { children: React.ReactNode } & GridProps) => {
    const { style, ...rest } = props;
    return (
        <Grid style={{ textAlign: 'center', ...style }} {...rest}>
            {children}
        </Grid>
    );
};

export default CenteredGridItem;
