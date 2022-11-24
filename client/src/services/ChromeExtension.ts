import {
    AsbPlayerToVideoCommandV2,
    ExtensionToAsbPlayerCommand,
    ExtensionToAsbPlayerCommandTabsCommand,
    Message,
    VideoTabModel,
} from '@project/common';
import { v4 as uuidv4 } from 'uuid';

export interface ExtensionMessage {
    data: Message;
    tabId?: number;
    src?: string;
}

const id = uuidv4();

export default class ChromeExtension {
    readonly version: string;

    tabs: VideoTabModel[];
    installed: boolean;

    private readonly windowEventListener: (event: MessageEvent) => void;
    private onMessageCallbacks: Array<(message: ExtensionMessage) => void>;
    private onTabsCallbacks: Array<(tabs: VideoTabModel[]) => void>;
    private heartbeatStarted = false;

    constructor(version?: string) {
        this.onMessageCallbacks = [];
        this.onTabsCallbacks = [];
        this.tabs = [];
        this.installed = version !== undefined;
        this.version = version ?? '';
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

    startHeartbeat() {
        if (!this.heartbeatStarted) {
            this._sendHeartbeat();
            setInterval(() => this._sendHeartbeat(), 1000);
            this.heartbeatStarted = true;
        }
    }

    private _sendHeartbeat() {
        window.postMessage(
            {
                sender: 'asbplayerv2',
                message: {
                    command: 'heartbeat',
                    id: id,
                    receivedTabs: this.tabs,
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

    publishMessage(message: Message) {
        for (const tab of this.tabs) {
            const command: AsbPlayerToVideoCommandV2<Message> = {
                sender: 'asbplayerv2',
                message: message,
                tabId: tab.id,
                src: tab.src,
            };
            window.postMessage(command, '*');
        }
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
