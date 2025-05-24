import TutorialBubble from './TutorialBubble';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import { useState } from 'react';

const AnkiDialogTutorialBubble: React.FC<{
    disabled: boolean;
    show: boolean;
    children: React.ReactElement;
    onConfirm: () => void;
}> = ({ disabled, show, children, onConfirm }) => {
    const [showAnkiExplanation, setShowAnkiExplanation] = useState<boolean>();
    return (
        <TutorialBubble
            placement="bottom"
            disabled={disabled}
            disableArrow
            text={
                showAnkiExplanation ? (
                    <>
                        <Link href="https://apps.ankiweb.net/" target="_blank">
                            Anki
                        </Link>{' '}
                        is the most popular flashcard program in the world. It uses an algorithm called <b>SRS</b> to
                        make learning information very efficient.
                    </>
                ) : (
                    <>
                        Use the <b>Anki Export Dialog</b> to create Anki flashcards. In most cases, asbplayer can fill
                        out <b>sentence</b>, <b>image</b>, and <b>audio</b> automatically.
                        <p />
                        <Button onClick={() => setShowAnkiExplanation(true)} variant="contained" fullWidth>
                            What's Anki?
                        </Button>
                    </>
                )
            }
            onConfirm={onConfirm}
            show={show}
        >
            {children}
        </TutorialBubble>
    );
};

export default AnkiDialogTutorialBubble;
