import {
    AsbPlayerToVideoCommandV2,
    CopySubtitleMessage,
    CurrentTimeToVideoMessage,
    LoadSubtitlesMessage,
    MobileOverlayToVideoCommand,
    OffsetToVideoMessage,
    PlaybackRateToVideoMessage,
    PlayMode,
    PlayModeMessage,
    ToggleSubtitlesMessage,
} from '@project/common';
import { useCallback } from 'react';
import { useMobileVideoOverlayModel } from '../hooks/use-mobile-video-overlay-model';
import { useMobileVideoOverlayLocation } from '../hooks/use-mobile-video-overlay-location';
import { SettingsProvider } from '@project/common/settings';
import { ExtensionSettingsStorage } from '../../services/extension-settings-storage';
import MobileVideoOverlay from '@project/common/components/MobileVideoOverlay';
import { useI18n } from '../hooks/use-i18n';

const settings = new SettingsProvider(new ExtensionSettingsStorage());
const params = new URLSearchParams(location.search);
const anchor = params.get('anchor') as 'top' | 'bottom';
const tooltipsEnabled = params.get('tooltips') === 'true';

const MobileVideoOverlayUi = () => {
    const location = useMobileVideoOverlayLocation();

    const handleMineSubtitle = useCallback(async () => {
        if (!location) {
            return;
        }

        const command: AsbPlayerToVideoCommandV2<CopySubtitleMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'copy-subtitle',
                postMineAction: await settings.getSingle('clickToMineDefaultAction'),
            },
            tabId: location.tabId,
            src: location.src,
        };
        chrome.runtime.sendMessage(command);
    }, [location]);

    const handleLoadSubtitles = useCallback(() => {
        if (!location) {
            return;
        }

        const command: AsbPlayerToVideoCommandV2<LoadSubtitlesMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'load-subtitles' },
            tabId: location.tabId,
            src: location.src,
        };
        chrome.runtime.sendMessage(command);
    }, [location]);

    const handleOffset = useCallback(
        (offset: number) => {
            if (!location) {
                return;
            }

            const command: AsbPlayerToVideoCommandV2<OffsetToVideoMessage> = {
                sender: 'asbplayerv2',
                message: { command: 'offset', value: offset, echo: true },
                tabId: location.tabId,
                src: location.src,
            };
            chrome.runtime.sendMessage(command);
        },
        [location]
    );

    const handleSeek = useCallback(
        (timestampMs: number) => {
            if (!location) {
                return;
            }

            const command: AsbPlayerToVideoCommandV2<CurrentTimeToVideoMessage> = {
                sender: 'asbplayerv2',
                message: { command: 'currentTime', value: timestampMs / 1000 },
                tabId: location.tabId,
                src: location.src,
            };
            chrome.runtime.sendMessage(command);
        },
        [location]
    );

    const handlePlaybackRate = useCallback(
        (playbackRate: number) => {
            if (!location) {
                return;
            }

            const command: AsbPlayerToVideoCommandV2<PlaybackRateToVideoMessage> = {
                sender: 'asbplayerv2',
                message: { command: 'playbackRate', value: playbackRate },
                tabId: location.tabId,
                src: location.src,
            };
            chrome.runtime.sendMessage(command);
        },
        [location]
    );

    const model = useMobileVideoOverlayModel({ location });

    const handlePlayModeSelected = useCallback(
        (playMode: PlayMode) => {
            if (!location) {
                return;
            }

            const command: MobileOverlayToVideoCommand<PlayModeMessage> = {
                sender: 'asbplayer-mobile-overlay-to-video',
                message: {
                    command: 'playMode',
                    playMode,
                },
                src: location.src,
            };
            chrome.runtime.sendMessage(command);
        },
        [location]
    );

    const handleToggleSubtitles = useCallback(() => {
        if (!location) {
            return;
        }

        const command: MobileOverlayToVideoCommand<ToggleSubtitlesMessage> = {
            sender: 'asbplayer-mobile-overlay-to-video',
            message: {
                command: 'toggle-subtitles',
            },
            src: location.src,
        };
        chrome.runtime.sendMessage(command);
    }, [location]);

    const { initialized: i18nInitialized } = useI18n({ language: model?.language ?? 'en' });

    if (!i18nInitialized) {
        return null;
    }

    return (
        <MobileVideoOverlay
            model={model}
            anchor={anchor}
            tooltipsEnabled={tooltipsEnabled}
            onMineSubtitle={handleMineSubtitle}
            onLoadSubtitles={handleLoadSubtitles}
            onOffset={handleOffset}
            onSeek={handleSeek}
            onPlaybackRate={handlePlaybackRate}
            onPlayModeSelected={handlePlayModeSelected}
            onToggleSubtitles={handleToggleSubtitles}
        />
    );
};

export default MobileVideoOverlayUi;
