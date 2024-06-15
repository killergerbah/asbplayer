import React, { useEffect, useState } from 'react';
import TextField from '@material-ui/core/TextField';
import { useTranslation } from 'react-i18next';
import { Anki } from '../anki';
import InputAdornment from '@material-ui/core/InputAdornment';
import IconButton from '@material-ui/core/IconButton';
import SearchIcon from '@material-ui/icons/Search';
import Tooltip from '@material-ui/core/Tooltip';

interface Props {
    anki: Anki;
    disabled: boolean;
    text: string;
    onText: (text: string) => void;
    wordField: string;
}

export default function WordField({ anki, disabled, text, onText, wordField }: Props) {
    const { t } = useTranslation();
    const [lastSearchedWord, setLastSearchedWord] = useState<string>();
    const [duplicateNotes, setDuplicateNotes] = useState<string[]>([]);
    const [wordTimestamp, setWordTimestamp] = useState<number>(0);

    useEffect(() => {
        setWordTimestamp(Date.now());
    }, [text]);

    useEffect(() => {
        if (!text || !wordField) {
            return;
        }

        const trimmedWord = text.trim();

        if (trimmedWord === '' || trimmedWord === lastSearchedWord) {
            return;
        }

        const timeout = setTimeout(async () => {
            try {
                setDuplicateNotes(await anki.findNotesWithWord(trimmedWord));
                setLastSearchedWord(trimmedWord);
            } catch (e) {
                console.error(e);
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [text, wordTimestamp, lastSearchedWord, anki, wordField]);
    let wordHelperText;

    if (text && text.trim() === lastSearchedWord && wordField) {
        wordHelperText =
            duplicateNotes.length > 0
                ? t('ankiDialog.foundDuplicateNotes', {
                      count: duplicateNotes.length,
                      word: text,
                      field: wordField,
                  })
                : t('ankiDialog.foundNoDuplicateNote', { word: text, field: wordField });
    } else {
        wordHelperText = '';
    }

    return (
        <TextField
            variant="filled"
            color="secondary"
            fullWidth
            label={t('ankiDialog.word')}
            value={text}
            onChange={(e) => onText(e.target.value)}
            helperText={wordHelperText}
            InputProps={{
                endAdornment: (
                    <InputAdornment position="end">
                        <Tooltip title={t('ankiDialog.searchInAnki')!}>
                            <span>
                                <IconButton
                                    disabled={disabled || !wordField || !text || text.trim() === ''}
                                    onClick={() => anki.findNotesWithWordGui(text.trim())}
                                    edge="end"
                                >
                                    <SearchIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </InputAdornment>
                ),
            }}
        />
    );
}
