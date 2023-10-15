import Alert from '@material-ui/lab/Alert';
import { useTranslation } from 'react-i18next';

const ActiveTabPermissionObtainedNotification = () => {
    const { t } = useTranslation();
    return (
        <Alert severity="success" style={{ width: 500 }}>
            {t('info.activeTabPermissionObtained')}
        </Alert>
    );
};

export default ActiveTabPermissionObtainedNotification;
