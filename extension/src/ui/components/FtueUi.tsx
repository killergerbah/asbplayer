import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import { Trans, useTranslation } from 'react-i18next';
import InstallUi from './InstallUi';

const FtueUi = () => {
    const { t } = useTranslation();

    return (
        <InstallUi
            heading={<Typography variant="h5">{t('ftue.welcome')}</Typography>}
            body={
                <Typography variant="h6">
                    <Trans
                        i18nKey="ftue.welcomeBody"
                        components={[
                            <Link
                                key={0}
                                color="secondary"
                                target="_blank"
                                rel="noreferrer"
                                href={'https://github.com/killergerbah/asbplayer?tab=readme-ov-file#getting-started'}
                            >
                                readme
                            </Link>,
                        ]}
                    />
                </Typography>
            }
        />
    );
};

export default FtueUi;
