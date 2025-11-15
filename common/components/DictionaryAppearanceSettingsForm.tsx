import { useTranslation } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import Toolbar from '@mui/material/Toolbar';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormLabel from '@mui/material/FormLabel';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import LabelWithHoverEffect from './LabelWithHoverEffect';
import { DictionarySubtitleAppearance, getFullyKnownTokenStatus, TokenStyling } from '@project/common/settings';
import { NUM_TOKEN_STYLINGS } from '@project/common/settings/settings-provider';

export interface DictionaryAppearanceSettingsFormProps {
    open: boolean;
    title: string;
    appearance: DictionarySubtitleAppearance;
    onClose: () => void;
    onAppearanceChanged: (appearance: DictionarySubtitleAppearance) => void;
}

const DictionaryAppearanceSettingsForm = ({
    open,
    title,
    appearance,
    onClose,
    onAppearanceChanged,
}: DictionaryAppearanceSettingsFormProps) => {
    const { t } = useTranslation();

    const handleTokenStylingChange = (tokenStyling: TokenStyling) => {
        onAppearanceChanged({
            ...appearance,
            tokenStyling,
        });
    };

    const handleTokenStylingThicknessChange = (tokenStylingThickness: number) => {
        onAppearanceChanged({
            ...appearance,
            tokenStylingThickness,
        });
    };

    const handleTokenStatusColorChange = (tokenStatusIndex: number, color: string) => {
        const newColors = [...appearance.tokenStatusColors];
        newColors[tokenStatusIndex] = color;
        onAppearanceChanged({
            ...appearance,
            tokenStatusColors: newColors,
        });
    };

    const showThickness =
        appearance.tokenStyling === TokenStyling.UNDERLINE || appearance.tokenStyling === TokenStyling.OVERLINE;

    return (
        <Dialog fullWidth open={open} onClose={onClose}>
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    {title}
                </Typography>
                <IconButton edge="end" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Toolbar>
            <DialogContent>
                <Stack spacing={2}>
                    <FormLabel component="legend">{t('settings.dictionaryTokenStyling')}</FormLabel>
                    <RadioGroup row>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={appearance.tokenStyling === TokenStyling.TEXT}
                                    onChange={() => handleTokenStylingChange(TokenStyling.TEXT)}
                                />
                            }
                            label={t('settings.dictionaryTokenStylingText')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={appearance.tokenStyling === TokenStyling.UNDERLINE}
                                    onChange={() => handleTokenStylingChange(TokenStyling.UNDERLINE)}
                                />
                            }
                            label={t('settings.dictionaryTokenStylingUnderline')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={appearance.tokenStyling === TokenStyling.OVERLINE}
                                    onChange={() => handleTokenStylingChange(TokenStyling.OVERLINE)}
                                />
                            }
                            label={t('settings.dictionaryTokenStylingOverline')}
                        />
                    </RadioGroup>

                    {showThickness && (
                        <TextField
                            type="number"
                            label={t('settings.dictionaryTokenStylingThickness')}
                            fullWidth
                            value={appearance.tokenStylingThickness}
                            color="primary"
                            onChange={(e) => handleTokenStylingThicknessChange(Number(e.target.value))}
                            slotProps={{
                                htmlInput: {
                                    min: 0.01,
                                    step: 0.01,
                                },
                            }}
                        />
                    )}

                    <FormControlLabel
                        control={
                            <Switch
                                checked={appearance.colorizeFullyKnownTokens}
                                onChange={(e) =>
                                    onAppearanceChanged({ ...appearance, colorizeFullyKnownTokens: e.target.checked })
                                }
                            />
                        }
                        label={t('settings.dictionaryColorizeFullyKnownTokens')}
                    />

                    {[...Array(NUM_TOKEN_STYLINGS).keys()].map((i) => {
                        const tokenStatusIndex = NUM_TOKEN_STYLINGS - 1 - i;
                        if (!appearance.colorizeFullyKnownTokens && tokenStatusIndex === getFullyKnownTokenStatus()) {
                            return null;
                        }
                        return (
                            <TextField
                                key={i}
                                type="color"
                                label={t(`settings.dictionaryTokenStatus${tokenStatusIndex}`)}
                                fullWidth
                                value={appearance.tokenStatusColors[tokenStatusIndex]}
                                color="primary"
                                onChange={(e) => handleTokenStatusColorChange(tokenStatusIndex, e.target.value)}
                            />
                        );
                    })}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('action.ok')}</Button>
            </DialogActions>
        </Dialog>
    );
};

export default DictionaryAppearanceSettingsForm;
