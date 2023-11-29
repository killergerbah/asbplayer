import { GetSettingsMessage, SetSettingsMessage } from '@project/common';
import { AsbplayerSettings, SettingsStorage } from '@project/common/settings';
import Bridge from './bridge';
import { v4 as uuidv4 } from 'uuid';

export class BridgeSettingsStorage implements SettingsStorage {
    private readonly _bridge: Bridge;

    constructor(bridge: Bridge) {
        this._bridge = bridge;
    }

    async get(keysAndDefaults: Partial<AsbplayerSettings>): Promise<Partial<AsbplayerSettings>> {
        const messageId = uuidv4();
        const message: GetSettingsMessage = { command: 'get-settings', messageId, keysAndDefaults };
        const response = await this._bridge.sendMessageFromServerAndExpectResponse(message);
        return response['response'];
    }

    set(settings: Partial<AsbplayerSettings>): Promise<void> {
        const messageId = uuidv4();
        const message: SetSettingsMessage = { command: 'set-settings', messageId, settings };
        return this._bridge.sendMessageFromServerAndExpectResponse(message);
    }
}
