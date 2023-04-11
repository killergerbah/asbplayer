import { Message, TabsMessage } from './message';

export interface Command<T extends Message> {
    readonly sender: string;
    readonly message: T;
}

export interface AsbPlayerToVideoCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer';
    readonly tabId: number;
    readonly src?: string;
}

export interface AsbPlayerToVideoCommandV2<T extends Message> extends Command<T> {
    readonly sender: 'asbplayerv2';
    readonly tabId: number;
    readonly src: string;
}

export interface ExtensionToVideoCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-extension-to-video';
    readonly src?: string;
}

export interface VideoToExtensionCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-video';
    readonly src: string;
}

export interface ForegroundToExtensionCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-foreground';
}

export interface ExtensionToAsbPlayerCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-extension-to-player';
    readonly tabId?: number;
    readonly src?: string;
}

export interface PopupToExtensionCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-popup';
}

export interface ExtensionToAsbPlayerCommandTabsCommand extends Command<TabsMessage> {
    readonly sender: 'asbplayer-extension-to-player';
}

export interface ExtensionToBackgroundPageCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-extension-to-background-page';
}

export interface BackgroundPageToExtensionCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-background-page';
}
