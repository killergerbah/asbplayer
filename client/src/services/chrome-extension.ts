import {
    AsbPlayerToVideoCommandV2,
    Command,
    ExtensionToAsbPlayerCommand,
    ExtensionToAsbPlayerCommandTabsCommand,
    Message,
    SharedGlobalSettings,
    SharedSettingsUpdatedMessage,
    VideoTabModel,
} from '@project/common';
import { gt } from 'semver';
import { v4 as uuidv4 } from 'uuid';

export interface ExtensionMessage {
    data: Message;
    tabId?: number;
    src?: string;
}

const id = uuidv4();

export default class ChromeExtension {
    readonly version: string;
    readonly extensionCommands: { [key: string]: string | undefined };

    tabs: VideoTabModel[];
    installed: boolean;

    private readonly windowEventListener: (event: MessageEvent) => void;
    private onMessageCallbacks: Array<(message: ExtensionMessage) => void>;
    private onTabsCallbacks: Array<(tabs: VideoTabModel[]) => void>;
    private heartbeatStarted = false;

    constructor(version?: string, extensionCommands?: { [key: string]: string | undefined }) {
        this.onMessageCallbacks = [];
        this.onTabsCallbacks = [];
        this.tabs = [];
        this.installed = version !== undefined;
        this.version = version ?? '';
        this.extensionCommands = extensionCommands ?? {};
        this.windowEventListener = (event: MessageEvent) => {
            if (event.source !== window) {
                return;
            }

            if (event.data.sender !== 'asbplayer-extension-to-player' || !event.data.message) {
                return;
            }

            if (event.data.message.command === 'tabs') {
                const tabsCommand = event.data as ExtensionToAsbPlayerCommandTabsCommand;
                this.tabs = tabsCommand.message.tabs;

                for (let c of this.onTabsCallbacks) {
                    c(this.tabs);
                }

                if (tabsCommand.message.ackRequested) {
                    window.postMessage(
                        {
                            sender: 'asbplayerv2',
                            message: {
                                command: 'ackTabs',
                                id: id,
                                receivedTabs: this.tabs,
                            },
                        },
                        '*'
                    );
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

    startHeartbeat(fromVideoPlayer: boolean) {
        if (!this.installed) {
            return;
        }

        if (!this.heartbeatStarted) {
            if (fromVideoPlayer) {
                if (gt(this.version, '0.23.0')) {
                    setInterval(() => this._sendHeartbeat(true), 1000);
                }
            } else {
                setInterval(() => this._sendHeartbeat(false), 1000);
            }

            this.heartbeatStarted = true;
        }
    }

    private _sendHeartbeat(fromVideoPlayer: boolean) {
        window.postMessage(
            {
                sender: 'asbplayerv2',
                message: {
                    command: 'heartbeat',
                    id: id,
                    receivedTabs: fromVideoPlayer ? [] : this.tabs,
                    videoPlayer: fromVideoPlayer,
                },
            },
            '*'
        );
    }

    openShortcuts() {
        window.postMessage({
            sender: 'asbplayerv2',
            message: {
                command: 'open-extension-shortcuts',
            },
        });
    }

    sendMessage(message: Message, tabId: number, src: string) {
        const command: AsbPlayerToVideoCommandV2<Message> = {
            sender: 'asbplayerv2',
            message: message,
            tabId: tabId,
            src: src,
        };
        window.postMessage(command, '*');
    }

    publishSharedGlobalSettings(settings: SharedGlobalSettings) {
        const command: Command<SharedSettingsUpdatedMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'shared-settings-updated',
                settings: {
                    language: settings.language,
                    themeType: settings.themeType,
                },
            },
        };
        window.postMessage(command, '*');
    }

    subscribeTabs(callback: (tabs: VideoTabModel[]) => void) {
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
