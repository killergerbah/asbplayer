import type { Command, WhisperServiceHealthMessage } from '@project/common';
import type { WhisperServiceSettingsClient } from '@project/common/components/StreamingVideoSettingsTab';

export const whisperServiceSettingsClient: WhisperServiceSettingsClient = {
    requestPermission: (origin) => browser.permissions.request({ origins: [origin] }),
    checkHealth: (url, authToken) =>
        browser.runtime.sendMessage({
            sender: 'asbplayer-settings',
            message: { command: 'whisper-service-health', url, authToken } satisfies WhisperServiceHealthMessage,
        } satisfies Command<WhisperServiceHealthMessage>),
};
