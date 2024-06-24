import React, { useState, useEffect } from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
import TextField from '@material-ui/core/TextField';
import InputAdornment from '@material-ui/core/InputAdornment';
import Tooltip from '@material-ui/core/Tooltip';
import IconButton from '@material-ui/core/IconButton';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import { AudioClip } from '../audio-clip';
import { useTranslation } from 'react-i18next';

const useStyles = makeStyles((theme) => ({
    root: {
        cursor: 'pointer',
        '& input': {
            cursor: 'pointer',
        },
    },
}));

interface Props {
    audioClip: AudioClip;
    onPlayAudio: (e: React.MouseEvent<HTMLDivElement>) => void;
    onRerecord?: () => void;
}

const useAudioHelperText = (audioClip?: AudioClip, onRerecord?: () => void) => {
    const { t } = useTranslation();
    const [audioHelperText, setAudioHelperText] = useState<string>();
    const [audioClipPlayable, setAudioClipPlayable] = useState<boolean>();

    useEffect(() => {
        if (audioClip) {
            const playable = audioClip.error === undefined;
            setAudioClipPlayable(playable);

            if (playable) {
                if (onRerecord === undefined && !audioClip.isSliceable()) {
                    setAudioHelperText(t('ankiDialog.cannotUpdateAudio')!);
                } else {
                    setAudioHelperText(undefined);
                }
            } else {
                setAudioHelperText(t(audioClip.errorLocKey!)!);
            }
        }
    }, [audioClip, onRerecord, t]);

    return { audioHelperText, audioClipPlayable };
};

export default function AudioField({ audioClip, onPlayAudio, onRerecord }: Props) {
    const classes = useStyles();
    const { t } = useTranslation();
    let audioActionElement: JSX.Element | undefined = undefined;

    if (onRerecord !== undefined) {
        audioActionElement = (
            <Tooltip title={t('ankiDialog.rerecord')!}>
                <span>
                    <IconButton
                        disabled={audioClip?.error !== undefined}
                        onClick={(e) => {
                            e.stopPropagation();
                            onRerecord();
                        }}
                        edge="end"
                    >
                        <FiberManualRecordIcon />
                    </IconButton>
                </span>
            </Tooltip>
        );
    }

    const { audioHelperText, audioClipPlayable } = useAudioHelperText(audioClip, onRerecord);

    return (
        <div className={classes.root} onClick={onPlayAudio}>
            <TextField
                variant="filled"
                color="secondary"
                fullWidth
                value={audioClip.name}
                label={t('ankiDialog.audio')}
                helperText={audioHelperText}
                disabled={!audioClipPlayable}
                InputProps={{
                    endAdornment: audioActionElement && (
                        <InputAdornment position="end">{audioActionElement}</InputAdornment>
                    ),
                }}
            />
        </div>
    );
}
