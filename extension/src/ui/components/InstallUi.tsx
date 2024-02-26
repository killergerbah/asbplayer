import CssBaseline from '@material-ui/core/CssBaseline';
import Paper from '@material-ui/core/Paper';
import { ThemeProvider } from '@material-ui/core/styles';
import { createTheme } from '@project/common/theme';
import { useI18n } from '../hooks/use-i18n';
import CenteredGridContainer from './CenteredGridContainer';
import CenteredGridItem from './CenteredGridItem';

interface Props {
    heading: React.ReactNode;
    body: React.ReactNode;
}
const InstallUi = ({ heading, body }: Props) => {
    const theme = createTheme('dark');
    const { initialized: i18Initialized } = useI18n({ language: chrome.i18n.getUILanguage() });

    if (!i18Initialized) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Paper style={{ width: '100vw', height: '100vh' }} square>
                <CenteredGridContainer direction="column">
                    <CenteredGridItem>
                        <img style={{ width: 75 }} src={chrome.runtime.getURL('assets/image.png')} />
                    </CenteredGridItem>
                    <CenteredGridItem>{heading}</CenteredGridItem>
                    <CenteredGridItem>{body}</CenteredGridItem>
                </CenteredGridContainer>
            </Paper>
        </ThemeProvider>
    );
};

export default InstallUi;
