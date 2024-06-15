import React from 'react';
import TextField from '@material-ui/core/TextField';
import { useTranslation } from 'react-i18next';

interface Props {
    text: string;
    onTextChange: (text: string) => void;
}
export default function DefinitionField({ text, onTextChange }: Props) {
    const { t } = useTranslation();

    return (
        <TextField
            variant="filled"
            color="secondary"
            multiline
            fullWidth
            minRows={8}
            label={t('ankiDialog.definition')!}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
        />
    );
}
