import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, InputAdornment, Link, MenuItem, Stack, Switch, Typography } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import SettingsTextField from '@project/common/components/SettingsTextField';
import SwitchLabelWithHoverEffect from '@project/common/components/SwitchLabelWithHoverEffect';
import { JitenClient } from '@project/common/jiten/jiten';
import type { JitenDeck, JitenStatus } from '@project/common/jiten/jiten';
import type { AsbplayerSettings } from '@project/common/settings';

interface Props {
    settings: AsbplayerSettings;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
}

export default function JitenSettingsTab({ settings, onSettingChanged }: Props) {
    const { t } = useTranslation();
    const [showKey, setShowKey] = useState(false);
    const [status, setStatus] = useState<JitenStatus>();
    const [error, setError] = useState<string>();
    const [decks, setDecks] = useState<JitenDeck[]>([]);
    const client = useMemo(() => new JitenClient(settings.jitenApiKey), [settings.jitenApiKey]);
    useEffect(() => {
        let active = true;
        setStatus(undefined);
        setError(undefined);
        setDecks([]);
        if (settings.jitenApiKey) {
            void client.status().then(
                (status) => active && setStatus(status),
                (error: Error) => active && setError(error.message)
            );
            void client.decks().then(
                (decks) => active && setDecks(decks),
                (error: Error) => active && setError(error.message)
            );
        }
        return () => {
            active = false;
        };
    }, [client, settings.jitenApiKey]);

    return (
        <Stack spacing={2}>
            <SettingsTextField
                label={t('jiten.apiKey')}
                type={showKey ? 'text' : 'password'}
                value={settings.jitenApiKey}
                error={Boolean(error)}
                helperText={error}
                onChange={(event) => void onSettingChanged('jitenApiKey', event.target.value)}
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton
                                aria-label={t(showKey ? 'jiten.hideApiKey' : 'jiten.showApiKey')}
                                onClick={() => setShowKey(!showKey)}
                            >
                                {showKey ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                        </InputAdornment>
                    ),
                }}
            />
            <SettingsTextField
                select
                label={t('jiten.miningDeck')}
                value={
                    decks.some((deck) => deck.userStudyDeckId === settings.jitenMiningDeckId)
                        ? settings.jitenMiningDeckId
                        : 0
                }
                onChange={(event) => void onSettingChanged('jitenMiningDeckId', Number(event.target.value))}
            >
                <MenuItem value={0}>{t('jiten.chooseMiningDeck')}</MenuItem>
                {decks.map((deck) => (
                    <MenuItem key={deck.userStudyDeckId} value={deck.userStudyDeckId}>
                        {deck.name}
                    </MenuItem>
                ))}
            </SettingsTextField>
            <SwitchLabelWithHoverEffect
                label={t('jiten.includeVisual')}
                labelPlacement="start"
                control={
                    <Switch
                        checked={settings.jitenAttachVisual}
                        onChange={(_, checked) => void onSettingChanged('jitenAttachVisual', checked)}
                    />
                }
            />
            <SwitchLabelWithHoverEffect
                label={t('jiten.includeAudio')}
                labelPlacement="start"
                control={
                    <Switch
                        checked={settings.jitenAttachAudio}
                        onChange={(_, checked) => void onSettingChanged('jitenAttachAudio', checked)}
                    />
                }
            />
            {status && (
                <>
                    <Typography>{t('jiten.tier', { tier: status.tier })}</Typography>
                    <Typography>
                        {t('jiten.storage', {
                            used: (status.quota.usedBytes / (1024 * 1024)).toFixed(1),
                            maximum: (status.quota.maxBytes / (1024 * 1024)).toFixed(1),
                        })}
                    </Typography>
                </>
            )}
            <Link href="https://jiten.moe/reader" target="_blank" rel="noreferrer">
                {t('jiten.reader')}
            </Link>
            <Link href="https://jiten.moe/settings/account" target="_blank" rel="noreferrer">
                {t('jiten.account')}
            </Link>
        </Stack>
    );
}
