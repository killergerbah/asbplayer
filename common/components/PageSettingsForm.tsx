import { JSX, useState } from 'react';
import { MutablePageConfig, Page, PageConfig, PageSettings, YoutubePage } from '../settings';
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
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import LabelWithHoverEffect from './LabelWithHoverEffect';
import { pageMetadata } from '../pages';
import ListField from './ListField';
import ConfirmDisableCspDialog from './ConfirmDisableCspDialog';
import Tooltip from './Tooltip';
import { CspAdapter } from '../csp-adapter';
import { useDisableCspDnrRule } from '../hooks/use-disable-csp-dns-rule';

const maxAdditionalHostsLength = 50;
const youtubeTargetLanguageLimit = 3;

const totalLength = (strings: string[]) => {
    let total = 0;

    for (const str of strings) {
        total += str.length;
    }

    return total;
};

export interface PageSettingsFormProps {
    open: boolean;
    pageKey: keyof PageSettings;
    page: Page;
    defaultPageConfig: PageConfig;
    additionalControls?: JSX.Element;
    hasModifications: boolean;
    cspControlsEnabled: boolean;
    cspDisabled: boolean;
    disableCsp: () => Promise<void>;
    enableCsp: () => Promise<void>;
    onClose: () => void;
    onPageChanged: <K extends keyof PageSettings>(key: K, page: PageSettings[K]) => void;
}

const PageSettingsForm = (props: PageSettingsFormProps) => {
    if (props.pageKey === 'youtube') {
        return <YoutubePageSettingsForm {...props} />;
    }

    return <DefaultPageSettingsForm {...props} />;
};

const YoutubePageSettingsForm = (props: PageSettingsFormProps) => {
    const { t } = useTranslation();
    const { onPageChanged, page } = props;
    const { targetLanguages } = page as YoutubePage;

    return (
        <DefaultPageSettingsForm
            {...props}
            additionalControls={
                <ListField
                    label={t('extension.settings.pages.youtube.targetLanguages')}
                    items={targetLanguages ?? []}
                    onItemsChange={(newTargetLanguages) => {
                        if (newTargetLanguages.length <= youtubeTargetLanguageLimit) {
                            onPageChanged('youtube', { ...page, targetLanguages: newTargetLanguages });
                        }
                    }}
                />
            }
        />
    );
};

const DefaultPageSettingsForm = ({
    open,
    pageKey,
    page,
    defaultPageConfig,
    additionalControls,
    hasModifications,
    cspControlsEnabled,
    cspDisabled,
    disableCsp,
    enableCsp,
    onClose,
    onPageChanged,
}: PageSettingsFormProps) => {
    const { t } = useTranslation();
    const overrides = page.overrides;
    const handleOverrideFieldChanged = <K extends keyof MutablePageConfig>(key: K, value: MutablePageConfig[K]) => {
        const newOverrides = { ...page.overrides, [key]: value };
        if (typeof newOverrides[key] === 'string' && newOverrides[key] === (defaultPageConfig[key] ?? '')) {
            delete newOverrides[key];
        } else if (typeof newOverrides[key] === 'boolean' && newOverrides[key] === (defaultPageConfig[key] ?? false)) {
            delete newOverrides[key];
        }
        const newOverridesAreEmpty = Object.keys(newOverrides).length === 0;
        onPageChanged(pageKey, { ...page, overrides: newOverridesAreEmpty ? undefined : newOverrides });
    };
    const doNotAllowDisableCsp = page.additionalHosts !== undefined && page.additionalHosts.length > 0;
    const [confirmDisableCspDialogOpen, setConfirmDisableCspDialogOpen] = useState<boolean>(false);
    return (
        <>
            {cspControlsEnabled && (
                <ConfirmDisableCspDialog
                    open={confirmDisableCspDialogOpen}
                    onConfirm={async () => {
                        await disableCsp();
                        setConfirmDisableCspDialogOpen(false);
                    }}
                    onClose={() => setConfirmDisableCspDialogOpen(false)}
                />
            )}
            <Dialog fullWidth open={open} onClose={onClose}>
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        {pageMetadata[pageKey].title}
                    </Typography>
                    <IconButton edge="end" onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Toolbar>
                <DialogContent>
                    <Stack spacing={1.5}>
                        {hasModifications && (
                            <Alert
                                severity="warning"
                                action={
                                    <Button
                                        onClick={() => {
                                            onPageChanged(pageKey, {
                                                ...page,
                                                overrides: undefined,
                                                additionalHosts: undefined,
                                                targetLanguages: undefined,
                                            });
                                            if (cspDisabled) {
                                                enableCsp();
                                            }
                                        }}
                                        size="small"
                                    >
                                        {t('action.revert')}
                                    </Button>
                                }
                            >
                                {t('extension.settings.pages.overridesWarning')}
                            </Alert>
                        )}
                        <TextField
                            disabled
                            label={t('extension.settings.pages.host')}
                            value={defaultPageConfig.hostRegex}
                        />
                        <ListField
                            label={t('extension.settings.pages.additionalHosts')}
                            items={page.additionalHosts ?? []}
                            onItemsChange={(additionalHosts) => {
                                if (totalLength(additionalHosts) > maxAdditionalHostsLength) {
                                    return;
                                }

                                if (cspDisabled) {
                                    enableCsp();
                                }

                                onPageChanged(pageKey, {
                                    ...page,
                                    additionalHosts: additionalHosts.length === 0 ? undefined : additionalHosts,
                                });
                            }}
                        />
                        <TextField
                            label={t('extension.settings.pages.syncAllowedAtPath')}
                            value={overrides?.syncAllowedAtPath ?? defaultPageConfig.syncAllowedAtPath ?? ''}
                            onChange={(e) => handleOverrideFieldChanged('syncAllowedAtPath', e.target.value)}
                        />
                        <TextField
                            label={t('extension.settings.pages.syncAllowedAtHash')}
                            value={overrides?.syncAllowedAtHash ?? defaultPageConfig.syncAllowedAtHash ?? ''}
                            onChange={(e) => handleOverrideFieldChanged('syncAllowedAtHash', e.target.value)}
                        />
                        {/* <TextField
                            label={t('extension.settings.pages.autoSyncVideoSrc')}
                            value={overrides?.autoSyncVideoSrc ?? defaultPageConfig.autoSyncVideoSrc ?? ''}
                            onChange={(e) => handleOverrideFieldChanged('autoSyncVideoSrc', e.target.value)}
                        />
                        <TextField
                            label={t('extension.settings.pages.autoSyncElementId')}
                            value={overrides?.autoSyncElementId ?? defaultPageConfig.autoSyncElementId ?? ''}
                            onChange={(e) => handleOverrideFieldChanged('autoSyncElementId', e.target.value)}
                        />
                        <TextField
                            label={t('extension.settings.pages.ignoreVideoElementsClass')}
                            value={
                                overrides?.ignoreVideoElementsClass ?? defaultPageConfig.ignoreVideoElementsClass ?? ''
                            }
                            onChange={(e) => handleOverrideFieldChanged('ignoreVideoElementsClass', e.target.value)}
                        /> */}
                        {additionalControls}
                        <LabelWithHoverEffect
                            control={
                                <Switch
                                    checked={
                                        overrides?.searchShadowRootsForVideoElements ??
                                        defaultPageConfig.searchShadowRootsForVideoElements ??
                                        false
                                    }
                                    onChange={(e) =>
                                        handleOverrideFieldChanged(
                                            'searchShadowRootsForVideoElements',
                                            e.target.checked
                                        )
                                    }
                                />
                            }
                            label={t('extension.settings.pages.searchShadowRootsForVideoElements')}
                            labelPlacement="start"
                        />
                        <LabelWithHoverEffect
                            control={
                                <Switch
                                    checked={
                                        overrides?.allowVideoElementsWithBlankSrc ??
                                        defaultPageConfig.allowVideoElementsWithBlankSrc ??
                                        false
                                    }
                                    onChange={(e) =>
                                        handleOverrideFieldChanged('allowVideoElementsWithBlankSrc', e.target.checked)
                                    }
                                />
                            }
                            label={t('extension.settings.pages.allowVideoElementsWithBlankSrc')}
                            labelPlacement="start"
                        />
                        <LabelWithHoverEffect
                            control={
                                <Switch
                                    checked={overrides?.autoSyncEnabled ?? defaultPageConfig.autoSyncEnabled ?? false}
                                    onChange={(e) => handleOverrideFieldChanged('autoSyncEnabled', e.target.checked)}
                                />
                            }
                            label={t('extension.settings.pages.autoSyncEnabled')}
                            labelPlacement="start"
                        />
                        {cspControlsEnabled && (
                            <Tooltip
                                disabled={!doNotAllowDisableCsp}
                                title={t('extension.settings.pages.disableCspRestrictions')}
                            >
                                <LabelWithHoverEffect
                                    control={
                                        <Switch
                                            disabled={doNotAllowDisableCsp}
                                            checked={cspDisabled}
                                            onClickCapture={async (e) => {
                                                e.stopPropagation();
                                                if (cspDisabled) {
                                                    await enableCsp();
                                                } else {
                                                    setConfirmDisableCspDialogOpen(true);
                                                }
                                            }}
                                        />
                                    }
                                    label={t('extension.settings.pages.disableCsp')}
                                    labelPlacement="start"
                                />
                            </Tooltip>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>{t('action.ok')}</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default PageSettingsForm;
