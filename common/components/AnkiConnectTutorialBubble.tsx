import TutorialBubble from './TutorialBubble';
import Link from '@mui/material/Link';

const AnkiConnectTutorialBubble: React.FC<{
    show: boolean;
    disabled: boolean;
    ankiConnectUrlError: boolean;
    children: React.ReactElement;
    onConfirm: () => void;
}> = ({ show, disabled, ankiConnectUrlError, children, onConfirm }) => {
    return (
        <TutorialBubble
            show={show}
            disabled={disabled}
            placement="bottom"
            text={
                <>
                    <Link href="https://ankiweb.net/shared/info/2055492159" target="_blank">
                        AnkiConnect
                    </Link>{' '}
                    allows asbplayer to connect to{' '}
                    <Link href="https://apps.ankiweb.net/" target="_blank">
                        Anki
                    </Link>
                    .
                    {ankiConnectUrlError && (
                        <>
                            <p />
                            Once you've opened Anki and installed AnkiConnect, clicking the ⟳ button should make the
                            error go away.
                        </>
                    )}
                </>
            }
            onConfirm={onConfirm}
        >
            {children}
        </TutorialBubble>
    );
};

export default AnkiConnectTutorialBubble;
