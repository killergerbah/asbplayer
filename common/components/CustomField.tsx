import TextField from '@mui/material/TextField';

interface Props {
    name: string;
    text: string;
    onTextChange: (name: string, text: string) => void;
}

export default function CustomField({ name, text, onTextChange }: Props) {
    return (
        <TextField
            key={name}
            variant="filled"
            color="primary"
            fullWidth
            multiline
            maxRows={8}
            label={name}
            value={text}
            onChange={(e) => onTextChange(name, e.target.value)}
        />
    );
}
