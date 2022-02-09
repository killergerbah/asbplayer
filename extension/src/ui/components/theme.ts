import { createMuiTheme } from '@material-ui/core/styles';
import { red } from '@material-ui/core/colors';
import { PaletteType } from '@material-ui/core';

export const createTheme = (themeType: PaletteType) =>
    createMuiTheme({
        palette: {
            primary: {
                main: '#49007a',
            },
            secondary: {
                main: '#ff1f62',
            },
            error: {
                main: red.A400,
            },
            background: {
                default: 'rgba(0, 0, 0, 0)',
            },
            type: themeType as PaletteType,
        },
    });
