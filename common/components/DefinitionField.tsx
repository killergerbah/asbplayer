import TextField from '@mui/material/TextField';
import Link from '@mui/material/Link';
import { useTranslation, Trans } from 'react-i18next';
import TutorialBubble from './TutorialBubble';
interface Props {
    text: string;
    onTextChange: (text: string) => void;
    disableTutorial?: boolean;
    showTutorial?: boolean;
    onConfirmTutorial?: () => void;
}
export default function DefinitionField({
    text,
    onTextChange,
    disableTutorial,
    showTutorial,
    onConfirmTutorial,
}: Props) {
    const { t } = useTranslation();

    return (
        <TutorialBubble
            disabled={disableTutorial}
            placement="bottom"
            text={
                <>
                    <Trans i18nKey="ftue.ankiDialogDefinition" components={[<b key={0}>Definition Field</b>]} />
                    <p />
                    <Trans
                        i18nKey="ftue.ankiDialogDefinitionHint"
                        components={[
                            <Link key={0} href="https://yomitan.wiki/" target="_blank">
                                Yomitan
                            </Link>,
                        ]}
                    />
                </>
            }
            show={showTutorial}
            onConfirm={() => onConfirmTutorial?.()}
        >
            <TextField
                variant="filled"
                color="primary"
                multiline
                maxRows={8}
                fullWidth
                label={t('ankiDialog.definition')!}
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
            />
        </TutorialBubble>
    );
}
