import TabRegistry from './services/tab-registry';
import Settings from './services/settings';
import ImageCapturer from './services/image-capturer';
import VideoHeartbeatHandler from './handlers/video/video-heartbeat-handler';
import RecordMediaHandler from './handlers/video/record-media-handler';
import RerecordMediaHandler from './handlers/video/rerecord-media-handler';
import StartRecordingMediaHandler from './handlers/video/start-recording-media-handler';
import StopRecordingMediaHandler from './handlers/video/stop-recording-media-handler';
import ToggleSubtitlesHandler from './handlers/video/toggle-subtitles-handler';
import SyncHandler from './handlers/video/sync-handler';
import HttpPostHandler from './handlers/video/http-post-handler';
import VideoToAsbplayerCommandForwardingHandler from './handlers/video/video-to-asbplayer-command-forwarding-handler';
import AsbplayerToVideoCommandForwardingHandler from './handlers/asbplayer/asbplayer-to-video-command-forwarding-handler';
import AsbplayerV2ToVideoCommandForwardingHandler from './handlers/asbplayerv2/asbplayer-v2-to-video-command-forwarding-handler';
import AsbplayerHeartbeatHandler from './handlers/asbplayerv2/asbplayer-heartbeat-handler';
import RefreshSettingsHandler from './handlers/popup/refresh-settings-handler';
import { CommandHandler } from './handlers/command-handler';
import TakeScreenshotHandler from './handlers/video/take-screenshot-handler';
import BackgroundPageAudioRecorder from './services/background-page-audio-recorder';
import BackgroundPageReadyHandler from './handlers/backgroundpage/background-page-ready-handler';
import AudioBase64Handler from './handlers/backgroundpage/audio-base-64-handler';
import AckTabsHandler from './handlers/asbplayerv2/ack-tabs-handler';
import { newVersionAvailable } from './services/version-checker';
import OpenExtensionShortcutsHandler from './handlers/asbplayerv2/open-extension-shortcuts-handler';
import EditKeyboardShortcutsHandler from './handlers/popup/edit-keyboard-shortcuts-handler';
import ExtensionCommandsHandler from './handlers/asbplayerv2/extension-commands-handler';
import OpenAsbplayerSettingsHandler from './handlers/video/open-asbplayer-settings-handler';
import CaptureVisibleTabHandler from './handlers/foreground/capture-visible-tab-handler';
import CopyToClipboardHandler from './handlers/video/copy-to-clipboard-handler';
import SharedSettingsUpdatedHandler from './handlers/asbplayerv2/shared-settings-updated-handler';
import {
    Command,
    CopySubtitleMessage,
    ExtensionToVideoCommand,
    Message,
    PostMineAction,
    TakeScreenshotMessage,
    ToggleRecordingMessage,
    ToggleVideoSelectMessage,
} from '@project/common';
import { primeLocalization } from './services/localization-fetcher';
import VideoDisappearedHandler from './handlers/video/video-disappeared-handler';

chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

const settings = new Settings();

const startListener = async () => {
    const [newVersion] = await newVersionAvailable();

    if (newVersion === true) {
        await chrome.action.setBadgeBackgroundColor({ color: 'red' });
        await chrome.action.setBadgeText({ text: '!' });
    }

    primeLocalization(await settings.getSingle('lastLanguage'));
};

chrome.runtime.onInstalled.addListener(startListener);
chrome.runtime.onStartup.addListener(startListener);

const tabRegistry = new TabRegistry(settings);
const backgroundPageAudioRecorder = new BackgroundPageAudioRecorder(tabRegistry);
const imageCapturer = new ImageCapturer(settings);

const handlers: CommandHandler[] = [
    new VideoHeartbeatHandler(tabRegistry),
    new RecordMediaHandler(backgroundPageAudioRecorder, imageCapturer, tabRegistry),
    new RerecordMediaHandler(backgroundPageAudioRecorder, tabRegistry),
    new StartRecordingMediaHandler(backgroundPageAudioRecorder, imageCapturer),
    new StopRecordingMediaHandler(backgroundPageAudioRecorder, imageCapturer, tabRegistry),
    new TakeScreenshotHandler(imageCapturer, tabRegistry),
    new ToggleSubtitlesHandler(settings, tabRegistry),
    new SyncHandler(tabRegistry),
    new HttpPostHandler(),
    new OpenAsbplayerSettingsHandler(tabRegistry),
    new CopyToClipboardHandler(),
    new VideoDisappearedHandler(tabRegistry),
    new VideoToAsbplayerCommandForwardingHandler(tabRegistry),
    new AsbplayerToVideoCommandForwardingHandler(),
    new AsbplayerHeartbeatHandler(tabRegistry),
    new AckTabsHandler(tabRegistry),
    new SharedSettingsUpdatedHandler(settings, tabRegistry),
    new OpenExtensionShortcutsHandler(),
    new ExtensionCommandsHandler(),
    new AsbplayerV2ToVideoCommandForwardingHandler(),
    new RefreshSettingsHandler(tabRegistry),
    new BackgroundPageReadyHandler(backgroundPageAudioRecorder),
    new AudioBase64Handler(backgroundPageAudioRecorder),
    new EditKeyboardShortcutsHandler(tabRegistry),
    new CaptureVisibleTabHandler(),
];

chrome.runtime.onMessage.addListener((request: Command<Message>, sender, sendResponse) => {
    for (const handler of handlers) {
        if (handler.sender === request.sender) {
            if (handler.command === null || handler.command === request.message.command) {
                if (handler.handle(request, sender, sendResponse) === true) {
                    return true;
                }

                break;
            }
        }
    }
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'load-subtitles',
        title: chrome.i18n.getMessage('contextMenuLoadSubtitles'),
        contexts: ['page', 'video'],
    });

    chrome.contextMenus.create({
        id: 'mine-subtitle',
        title: chrome.i18n.getMessage('contextMenuMineSubtitle'),
        contexts: ['page', 'video'],
    });
});

chrome.contextMenus.onClicked.addListener((info) => {
    tabRegistry.publishCommandToVideoElements((videoElement): ExtensionToVideoCommand<Message> | undefined => {
        if (info.srcUrl !== undefined && videoElement.src !== info.srcUrl) {
            return undefined;
        }

        if (info.srcUrl === undefined && info.pageUrl !== videoElement.tab.url) {
            return undefined;
        }

        switch (info.menuItemId) {
            case 'load-subtitles':
                const toggleVideoSelectCommand: ExtensionToVideoCommand<ToggleVideoSelectMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'toggle-video-select',
                    },
                    src: videoElement.src,
                };
                return toggleVideoSelectCommand;
            case 'mine-subtitle':
                const copySubtitleCommand: ExtensionToVideoCommand<CopySubtitleMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'copy-subtitle',
                        postMineAction: PostMineAction.showAnkiDialog,
                    },
                    src: videoElement.src,
                };
                return copySubtitleCommand;
            default:
                return undefined;
        }
    });
});

chrome.commands.onCommand.addListener((command) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
            return;
        }

        switch (command) {
            case 'copy-subtitle':
            case 'update-last-card':
            case 'copy-subtitle-with-dialog':
                const postMineAction = postMineActionFromCommand(command);
                tabRegistry.publishCommandToVideoElements((videoElement) => {
                    if (tabs.find((t) => t.id === videoElement.tab.id) === undefined) {
                        return undefined;
                    }

                    const extensionToVideoCommand: ExtensionToVideoCommand<CopySubtitleMessage> = {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'copy-subtitle',
                            postMineAction: postMineAction,
                        },
                        src: videoElement.src,
                    };
                    return extensionToVideoCommand;
                });

                tabRegistry.publishCommandToAsbplayers((asbplayer) => {
                    if (tabs.find((t) => t.id === asbplayer.tab.id) === undefined) {
                        return undefined;
                    }

                    const extensionToPlayerCommand: Command<CopySubtitleMessage> = {
                        sender: 'asbplayer-extension-to-player',
                        message: {
                            command: 'copy-subtitle',
                            postMineAction: postMineAction,
                        },
                    };
                    return extensionToPlayerCommand;
                });
                break;
            case 'toggle-video-select':
                for (const tab of tabs) {
                    if (typeof tab.id !== 'undefined') {
                        const extensionToVideoCommand: ExtensionToVideoCommand<ToggleVideoSelectMessage> = {
                            sender: 'asbplayer-extension-to-video',
                            message: {
                                command: 'toggle-video-select',
                            },
                        };
                        chrome.tabs.sendMessage(tab.id, extensionToVideoCommand);
                    }
                }
                break;
            case 'take-screenshot':
                tabRegistry.publishCommandToVideoElements((videoElement) => {
                    if (tabs.find((t) => t.id === videoElement.tab.id) === undefined) {
                        return undefined;
                    }

                    const extensionToVideoCommand: ExtensionToVideoCommand<TakeScreenshotMessage> = {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'take-screenshot',
                        },
                        src: videoElement.src,
                    };
                    return extensionToVideoCommand;
                });

                tabRegistry.publishCommandToAsbplayers((asbplayer) => {
                    if (tabs.find((t) => t.id === asbplayer.tab.id) === undefined) {
                        return undefined;
                    }

                    const extensionToPlayerCommand: Command<TakeScreenshotMessage> = {
                        sender: 'asbplayer-extension-to-player',
                        message: {
                            command: 'take-screenshot',
                        },
                    };
                    return extensionToPlayerCommand;
                });
                break;
            case 'toggle-recording':
                tabRegistry.publishCommandToVideoElements((videoElement) => {
                    if (tabs.find((t) => t.id === videoElement.tab.id) === undefined) {
                        return undefined;
                    }

                    const extensionToVideoCommand: ExtensionToVideoCommand<ToggleRecordingMessage> = {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'toggle-recording',
                        },
                        src: videoElement.src,
                    };
                    return extensionToVideoCommand;
                });
                break;
            default:
                throw new Error('Unknown command ' + command);
        }
    });
});

function postMineActionFromCommand(command: string) {
    switch (command) {
        case 'copy-subtitle':
            return PostMineAction.none;
        case 'copy-subtitle-with-dialog':
            return PostMineAction.showAnkiDialog;
        case 'update-last-card':
            return PostMineAction.updateLastCard;
        default:
            throw new Error('Cannot determine post mine action for unknown command ' + command);
    }
}
