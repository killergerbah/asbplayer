import CssBaseline from '@mui/material/CssBaseline';
import Paper from '@mui/material/Paper';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
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
    const { initialized: i18Initialized } = useI18n({ language: browser.i18n.getUILanguage() });

    if (!i18Initialized) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Paper style={{ width: '100vw', height: '100vh' }} square>
                <CenteredGridContainer direction="column">
                    <CenteredGridItem>
                        <img style={{ width: 75 }} src={browser.runtime.getURL('icon/image.png')} />
                    </CenteredGridItem>
                    <CenteredGridItem>{heading}</CenteredGridItem>
                    <CenteredGridItem>{body}</CenteredGridItem>
                </CenteredGridContainer>
            </Paper>
        </ThemeProvider>
    );
};

export default InstallUi;
