import ThemeProvider from '@mui/material/styles/ThemeProvider';
import CssBaseline from '@mui/material/CssBaseline';
import Paper from '@mui/material/Paper';
import { useI18n } from '../hooks/use-i18n';
import { createTheme } from '@project/common/theme';
import { makeStyles } from '@mui/styles';
import Tutorial from './Tutorial';

const useStyles = makeStyles({
    container: {
        width: '100dvw',
        height: '100dvh',
    },
    tutorial: {
        width: '100%',
        height: '100%',
    },
});

// Standalone page for accessing tutoral independently of the FTUE
const TutorialUi = () => {
    const theme = createTheme('dark');
    const { initialized: i18Initialized } = useI18n({ language: browser.i18n.getUILanguage() });
    const classes = useStyles();

    if (!i18Initialized) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Paper className={classes.container} square>
                <Tutorial className={classes.tutorial} show={true} />
            </Paper>
        </ThemeProvider>
    );
};

export default TutorialUi;
