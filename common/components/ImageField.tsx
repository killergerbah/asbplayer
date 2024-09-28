import React, { useState, useEffect } from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
import TextField from '@material-ui/core/TextField';
import InputAdornment from '@material-ui/core/InputAdornment';
import Tooltip from '@material-ui/core/Tooltip';
import IconButton from '@material-ui/core/IconButton';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import { useTranslation } from 'react-i18next';
import { Image, ImageErrorCode } from '@project/common';

const useStyles = makeStyles((theme) => ({
    root: {
        cursor: 'pointer',
        '& input': {
            cursor: 'pointer',
        },
    },
}));

const useImageHelperText = (image?: Image) => {
    const { t } = useTranslation();
    const [imageHelperText, setImageHelperText] = useState<string>();
    const [imageAvailable, setImageAvailable] = useState<boolean>();

    useEffect(() => {
        if (image) {
            if (image.error === undefined) {
                setImageAvailable(true);
                setImageHelperText(undefined);
            } else if (image.error === ImageErrorCode.fileLinkLost) {
                setImageHelperText(t('ankiDialog.imageFileLinkLost')!);
            } else if (image.error === ImageErrorCode.captureFailed) {
                setImageHelperText(t('ankiDialog.imageCaptureFailed')!);
            }
        }
    }, [image, t]);

    return { imageHelperText, imageAvailable };
};

interface Props {
    onViewImage: (e: React.MouseEvent<HTMLDivElement>) => void;
    onCopyImageToClipboard: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    image: Image;
    copyEnabled: boolean;
}

export default function ImageField({ image, onViewImage, onCopyImageToClipboard, copyEnabled }: Props) {
    const { t } = useTranslation();
    const classes = useStyles();
    const { imageHelperText, imageAvailable } = useImageHelperText(image);

    return (
        <div className={classes.root} onClick={onViewImage}>
            <TextField
                variant="filled"
                color="secondary"
                fullWidth
                value={image.name}
                label={t('ankiDialog.image')}
                helperText={imageHelperText}
                disabled={!imageAvailable}
                InputProps={{
                    endAdornment: copyEnabled && (
                        <InputAdornment position="end">
                            <Tooltip title={t('ankiDialog.copyToClipboard')!}>
                                <span>
                                    <IconButton disabled={!imageAvailable} onClick={onCopyImageToClipboard} edge="end">
                                        <FileCopyIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </InputAdornment>
                    ),
                }}
            />
        </div>
    );
}
