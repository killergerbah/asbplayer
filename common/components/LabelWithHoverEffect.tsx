import FormControlLabel from '@material-ui/core/FormControlLabel';
import styled from '@material-ui/core/styles/styled';

const LabelWithHoverEffect = styled(FormControlLabel)(({ theme }) => ({
    '&:hover .MuiSwitch-thumb': {
        outline: `9px solid ${theme.palette.secondary.main}29`,
    },
    '&:hover .MuiRadio-colorSecondary': {
        background: `${theme.palette.secondary.main}29`,
    },
}));

export default LabelWithHoverEffect;
