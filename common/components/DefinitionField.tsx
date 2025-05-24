import TextField from '@mui/material/TextField';
import Link from '@mui/material/Link';
import { useTranslation } from 'react-i18next';
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
                    Put any details you want to remember about the sentence in the <b>Definition Field</b>.
                    <p />
                    Hint: A dictionary extension like{' '}
                    <Link href="https://yomitan.wiki/" target="_blank">
                        Yomitan
                    </Link>{' '}
                    makes this really easy.
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
