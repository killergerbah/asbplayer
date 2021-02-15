import { red } from '@material-ui/core/colors';
import { createMuiTheme } from '@material-ui/core/styles';

// A custom theme for this app
const theme = createMuiTheme({
  palette: {
    primary: {
      main: '#3e00cf',
    },
    secondary: {
      main: '#1f9aff',
    },
    error: {
      main: red.A400,
    },
    type: 'dark',
  }
});

export default theme;