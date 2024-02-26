import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import { Trans, useTranslation } from 'react-i18next';
import InstallUi from './InstallUi';

const UpdateUi = () => {
    const { t } = useTranslation();
    const version = chrome.runtime.getManifest().version;

    return (
        <InstallUi
            heading={<Typography variant="h5">{t('update.heading', { version })}</Typography>}
            body={
                <Typography variant="h6">
                    <Trans
                        i18nKey="update.body"
                        components={[
                            <Link
                                key={0}
                                color="secondary"
                                target="_blank"
                                rel="noreferrer"
                                href={`https://github.com/killergerbah/asbplayer/releases/tag/v${version}`}
                            >
                                here
                            </Link>,
                        ]}
                    />
                </Typography>
            }
        />
    );
};

export default UpdateUi;
