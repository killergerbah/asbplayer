import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { SubtitleModel } from '..';
import SubtitleTextImage from './SubtitleTextImage';
import { useTranslation } from 'react-i18next';

interface TextImageSetProps {
    selectedSubtitles: SubtitleModel[];
    width: number;
}

const useTextImageSetStyles = makeStyles((theme) => ({
    root: {
        marginBottom: theme.spacing(1),
        padding: theme.spacing(1),
        backgroundColor: theme.palette.action.disabledBackground,
    },
}));

const TextImageSet = ({ selectedSubtitles, width }: TextImageSetProps) => {
    const classes = useTextImageSetStyles();

    if (selectedSubtitles.length === 0 || width <= 0) {
        return null;
    }

    return (
        <Paper elevation={0} className={classes.root}>
            {selectedSubtitles.map((s, index) => {
                return <SubtitleTextImage key={index} availableWidth={width} subtitle={s} scale={1} />;
            })}
        </Paper>
    );
};

interface Props {
    width: number;
    text: string;
    label: string;
    onChangeText: (text: string) => void;
    selectedSubtitles: SubtitleModel[];
}

export default function SentenceField({ width, text, label, onChangeText, selectedSubtitles }: Props) {
    const { t } = useTranslation();
    return (
        <>
            <TextImageSet
                selectedSubtitles={selectedSubtitles.filter((s) => s.textImage !== undefined)}
                width={width}
            />
            <TextField
                variant="filled"
                color="secondary"
                multiline
                fullWidth
                maxRows={8}
                label={label}
                value={text}
                onChange={(e) => onChangeText(e.target.value)}
            />
        </>
    );
}
