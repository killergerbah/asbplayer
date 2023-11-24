import {
    AsbPlayerCommand,
    AsbPlayerToVideoCommandV2,
    AsbplayerInstance,
    AsbplayerSettings,
    CardModel,
    Command,
    ExtensionToAsbPlayerCommand,
    ExtensionToAsbPlayerCommandTabsCommand,
    GetSettingsMessage,
    Message,
    MessageWithId,
    ToggleSidePanelMessage,
    PublishCardMessage,
    SetSettingsMessage,
    SettingsUpdatedMessage,
    VideoTabModel,
} from '@project/common';
import { v4 as uuidv4 } from 'uuid';
import gte from 'semver/functions/gte';
import gt from 'semver/functions/gt';

export interface ExtensionMessage {
    data: Message;
    tabId?: number;
    src?: string;
}

const id = uuidv4();

export default class ChromeExtension {
    readonly version: string;
    readonly extensionCommands: { [key: string]: string | undefined };

    tabs: VideoTabModel[] | undefined;
    asbplayers: AsbplayerInstance[] | undefined;
    installed: boolean;
    sidePanel: boolean;

    private readonly windowEventListener: (event: MessageEvent) => void;
    private readonly _responseResolves: { [key: string]: (value: any) => void } = {};
    private onMessageCallbacks: Array<(message: ExtensionMessage) => void>;
    private onTabsCallbacks: Array<(tabs: VideoTabModel[]) => void>;
    private heartbeatStarted = false;

    constructor(version?: string, extensionCommands?: { [key: string]: string | undefined }) {
        this.onMessageCallbacks = [];
        this.onTabsCallbacks = [];
        this.installed = version !== undefined;
        this.version = version ?? '';
        this.extensionCommands = extensionCommands ?? {};
        this.sidePanel = false;
        this.windowEventListener = (event: MessageEvent) => {
            if (event.source !== window) {
                return;
            }

            if (event.data.sender !== 'asbplayer-extension-to-player' || !event.data.message) {
                return;
            }

            if (typeof event.data.message.messageId === 'string') {
                const messageId = event.data.message.messageId;

                if (messageId in this._responseResolves) {
                    this._responseResolves[messageId]?.(event.data.message.response);
                    delete this._responseResolves[messageId];
                }
            }

            if (event.data.message.command === 'tabs') {
                const tabsCommand = event.data as ExtensionToAsbPlayerCommandTabsCommand;
                this.tabs = tabsCommand.message.tabs;
                this.asbplayers = tabsCommand.message.asbplayers;

                for (let c of this.onTabsCallbacks) {
                    c(this.tabs);
                }

                if (tabsCommand.message.ackRequested) {
                    window.postMessage({
                        sender: 'asbplayerv2',
                        message: {
                            command: 'ackTabs',
                            id: id,
                            receivedTabs: this.tabs,
                            sidePanel: this.sidePanel,
                        },
                    });
                }
            } else {
                const command = event.data as ExtensionToAsbPlayerCommand<Message>;

                for (let c of this.onMessageCallbacks) {
                    c({
                        data: command.message,
                        tabId: command.tabId,
                        src: command.src,
                    });
                }
            }
        };

        window.addEventListener('message', this.windowEventListener);
    }

    get supportsAppIntegration() {
        return this.installed && gte(this.version, '1.0.0');
    }

    get supportsPlaybackRateMessage() {
        return this.installed && gte(this.version, '0.24.0');
    }

    get supportsOffsetMessage() {
        return this.installed && gte(this.version, '0.23.0');
    }

    startHeartbeat({ fromVideoPlayer }: { fromVideoPlayer: boolean }) {
        if (!this.installed) {
            return;
        }

        if (!this.heartbeatStarted) {
            if (fromVideoPlayer) {
                if (gt(this.version, '0.23.0')) {
                    this._sendHeartbeat(true);
                    setInterval(() => this._sendHeartbeat(true), 1000);
                }
            } else {
                this._sendHeartbeat(false);
                setInterval(() => this._sendHeartbeat(false), 1000);
            }

            this.heartbeatStarted = true;
        }
    }

    private _sendHeartbeat(fromVideoPlayer: boolean) {
        window.postMessage({
            sender: 'asbplayerv2',
            message: {
                command: 'heartbeat',
                id: id,
                receivedTabs: fromVideoPlayer ? [] : this.tabs,
                videoPlayer: fromVideoPlayer,
                sidePanel: this.sidePanel,
            },
        });
    }

    openShortcuts() {
        window.postMessage({
            sender: 'asbplayerv2',
            message: {
                command: 'open-extension-shortcuts',
            },
        });
    }

    sendMessageToVideoElement(message: Message, tabId: number, src: string, callback?: (response: any) => void) {
        let command: AsbPlayerToVideoCommandV2<Message> | AsbPlayerToVideoCommandV2<MessageWithId>;

        if (callback === undefined) {
            command = {
                sender: 'asbplayerv2',
                message,
                tabId: tabId,
                src: src,
            };
            window.postMessage(command);
        } else {
            const messageId = uuidv4();
            command = {
                sender: 'asbplayerv2',
                message: { ...message, messageId },
                tabId: tabId,
                src: src,
            };
            window.postMessage(command);
            this._createResponsePromise(messageId).then(callback);
        }
    }

    notifySettingsUpdated() {
        const command: Command<SettingsUpdatedMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'settings-updated',
            },
        };
        window.postMessage(command);
    }

    toggleSidePanel() {
        const command: Command<ToggleSidePanelMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'toggle-side-panel',
            },
        };
        window.postMessage(command);
    }

    publishCard(card: CardModel) {
        const command: Command<PublishCardMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'publish-card',
                ...card,
            },
        };
        window.postMessage(command);
    }

    getSettings(keysAndDefaults: Partial<AsbplayerSettings>): Promise<Partial<AsbplayerSettings>> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<GetSettingsMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'get-settings',
                keysAndDefaults,
                messageId,
            },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId);
    }

    setSettings(settings: Partial<AsbplayerSettings>): Promise<void> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<SetSettingsMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'set-settings',
                settings,
                messageId,
            },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId).then(() => this.notifySettingsUpdated());
    }

    private _createResponsePromise<T>(messageId: string) {
        return new Promise<T>((resolve, reject) => {
            this._responseResolves[messageId] = resolve;
            setTimeout(() => {
                if (messageId in this._responseResolves) {
                    delete this._responseResolves[messageId];
                    reject('Request timed out');
                }
            }, 5000);
        });
    }

    subscribeTabs(callback: (tabs: VideoTabModel[]) => void) {
        if (this.tabs !== undefined) {
            callback(this.tabs);
        }

        this.onTabsCallbacks.push(callback);
        return () => this._remove(callback, this.onTabsCallbacks);
    }

    subscribe(callback: (message: ExtensionMessage) => void) {
        this.onMessageCallbacks.push(callback);
        return () => this._remove(callback, this.onMessageCallbacks);
    }

    _remove(callback: Function, callbacks: Function[]) {
        for (let i = callbacks.length - 1; i >= 0; --i) {
            if (callback === callbacks[i]) {
                callbacks.splice(i, 1);
                break;
            }
        }
    }

    unbind() {
        window.removeEventListener('message', this.windowEventListener);
        this.onMessageCallbacks = [];
        this.onTabsCallbacks = [];
    }
}
