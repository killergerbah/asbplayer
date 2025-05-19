import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Trans, useTranslation } from 'react-i18next';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import CssBaseline from '@mui/material/CssBaseline';
import Paper from '@mui/material/Paper';
import { useI18n } from '../hooks/use-i18n';
import { createTheme } from '@project/common/theme';
import { makeStyles } from '@mui/styles';
import CenteredGridContainer from './CenteredGridContainer';
import CenteredGridItem from './CenteredGridItem';
import React from 'react';
import Tutorial from './Tutorial';

const useStyles = makeStyles({
    container: {
        scrollSnapType: 'y mandatory',
        width: '100dvw',
        height: '100dvh',
        overflowY: 'scroll',
    },
    child: {
        scrollSnapAlign: 'center',
        width: '100dvw',
        height: '100dvh',
    },
});

const WelcomeMessage: React.FC<{ className: string }> = ({ className }) => {
    const { t } = useTranslation();

    return (
        <CenteredGridContainer className={className} direction="column">
            <CenteredGridItem>
                <img style={{ width: 75 }} src={browser.runtime.getURL('/icon/image.png')} />
            </CenteredGridItem>
            <CenteredGridItem>
                <Typography variant="h5">{t('ftue.welcome')}</Typography>
            </CenteredGridItem>
            <CenteredGridItem>
                <Typography variant="h6">
                    <Trans
                        i18nKey="ftue.welcomeBody2"
                        components={[
                            <Link
                                key={0}
                                color="primary"
                                target="_blank"
                                rel="noreferrer"
                                href={'https://github.com/killergerbah/asbplayer?tab=readme-ov-file#getting-started'}
                            >
                                readme
                            </Link>,
                        ]}
                    />
                </Typography>
            </CenteredGridItem>
        </CenteredGridContainer>
    );
};

const FtueUi = () => {
    const theme = createTheme('dark');
    const { initialized: i18Initialized } = useI18n({ language: browser.i18n.getUILanguage() });
    const classes = useStyles();
    const [showTutorial, setShowTutorial] = useState<boolean>(false);
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (e.currentTarget.scrollTop > (window.innerHeight * 3) / 4) {
            setShowTutorial(true);
        } else {
            setShowTutorial(false);
        }
    };

    if (!i18Initialized) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Paper onScroll={handleScroll} className={classes.container} square>
                <WelcomeMessage className={classes.child} />
                <Tutorial show={showTutorial} className={classes.child} />
            </Paper>
        </ThemeProvider>
    );
};

export default FtueUi;
