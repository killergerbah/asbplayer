import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import CssBaseline from '@material-ui/core/CssBaseline';
import Paper from '@material-ui/core/Paper';
import { ThemeProvider } from '@material-ui/core/styles';
import { createTheme } from '@project/common/theme';
import { Trans, useTranslation } from 'react-i18next';
import { useI18n } from '../hooks/use-i18n';
import CenteredGridContainer from './CenteredGridContainer';
import CenteredGridItem from './CenteredGridItem';

const FtueUi = () => {
    const theme = createTheme('dark');
    const { t } = useTranslation();
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
                    <CenteredGridItem>
                        <Typography variant="h5">{t('ftue.welcome')}</Typography>
                    </CenteredGridItem>
                    <CenteredGridItem>
                        <Typography variant="h6">
                            <Trans
                                i18nKey="ftue.welcomeBody"
                                components={[
                                    <Link
                                        key={0}
                                        color="secondary"
                                        target="_blank"
                                        rel="noreferrer"
                                        href={
                                            'https://github.com/killergerbah/asbplayer?tab=readme-ov-file#getting-started'
                                        }
                                    >
                                        readme
                                    </Link>,
                                ]}
                            />
                        </Typography>
                    </CenteredGridItem>
                </CenteredGridContainer>
            </Paper>
        </ThemeProvider>
    );
};

export default FtueUi;
