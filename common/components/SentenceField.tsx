import React from 'react';
import Paper from '@material-ui/core/Paper';
import InputAdornment from '@material-ui/core/InputAdornment';
import TextField from '@material-ui/core/TextField';
import Tooltip from '@material-ui/core/Tooltip';
import IconButton from '@material-ui/core/IconButton';
import DoneIcon from '@material-ui/icons/Done';
import makeStyles from '@material-ui/core/styles/makeStyles';
import withStyles from '@material-ui/core/styles/withStyles';
import { SubtitleModel } from '..';
import SubtitleTextImage from './SubtitleTextImage';
import { useTranslation } from 'react-i18next';

const TextFieldEndAdornment = withStyles({
    // Hack to recenter TextField end adornment
    root: {
        transform: 'translateY(-8px)',
    },
})(InputAdornment);

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
    onChangeText: (text: string) => void;
    selectedSubtitles: SubtitleModel[];
    applySelectedRangeDisabled: boolean;
    onApplySelectedRangeToText: () => void;
}

export default function SentenceField({
    width,
    text,
    onChangeText,
    selectedSubtitles,
    applySelectedRangeDisabled,
    onApplySelectedRangeToText,
}: Props) {
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
                label={t('ankiDialog.sentence')}
                value={text}
                onChange={(e) => onChangeText(e.target.value)}
                InputProps={{
                    endAdornment: (
                        <TextFieldEndAdornment position="end">
                            <Tooltip title={t('ankiDialog.applySelection')!}>
                                <span>
                                    <IconButton
                                        disabled={applySelectedRangeDisabled}
                                        onClick={onApplySelectedRangeToText}
                                        edge="end"
                                    >
                                        <DoneIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </TextFieldEndAdornment>
                    ),
                }}
            />
        </>
    );
}
