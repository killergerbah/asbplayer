import styled from '@mui/styles/styled';
import TableContainer from '@mui/material/TableContainer';
import { type Theme } from '@mui/material';

const TableContainerWithUnconstrainedHeight = styled(TableContainer)<Theme>(({ theme }) => ({
    '& .MuiPaper-root': {
        height: 'auto',
    },
}));

export default TableContainerWithUnconstrainedHeight;
