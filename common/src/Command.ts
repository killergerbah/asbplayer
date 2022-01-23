import { Message } from './Message';

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
    readonly src: string;
}

export interface VideoToExtensionCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-video';
    readonly src: string;
}

export interface ExtensionToAsbPlayerCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-extension-to-player';
    readonly tabId: number;
    readonly src: string;
}
