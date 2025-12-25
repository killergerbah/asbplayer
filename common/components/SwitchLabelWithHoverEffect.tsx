import styled from '@mui/styles/styled';
import LabelWithHoverEffect from './LabelWithHoverEffect';

const SwitchLabelWithHoverEffect = styled(LabelWithHoverEffect)(() => ({
    justifyContent: 'space-between',
    marginLeft: 0,
    marginRight: -8,
}));

export default SwitchLabelWithHoverEffect;
