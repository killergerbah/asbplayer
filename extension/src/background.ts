import TabRegistry from './services/TabRegistry';
import Settings from './services/Settings';
import ImageCapturer from './services/ImageCapturer';
import VideoHeartbeatHandler from './handlers/video/VideoHeartbeatHandler';
import RecordMediaHandler from './handlers/video/RecordMediaHandler';
import RerecordMediaHandler from './handlers/video/RerecordMediaHandler';
import StartRecordingMediaHandler from './handlers/video/StartRecordingMediaHandler';
import StopRecordingMediaHandler from './handlers/video/StopRecordingMediaHandler';
import ToggleSubtitlesHandler from './handlers/video/ToggleSubtitlesHandler';
import SyncHandler from './handlers/video/SyncHandler';
import HttpPostHandler from './handlers/video/HttpPostHandler';
import VideoToAsbplayerCommandForwardingHandler from './handlers/video/VideoToAsbplayerCommandForwardingHandler';
import AsbplayerToVideoCommandForwardingHandler from './handlers/asbplayer/AsbplayerToVideoCommandForwardingHandler';
import AsbplayerV2ToVideoCommandForwardingHandler from './handlers/asbplayerv2/AsbplayerV2ToVideoCommandForwardingHandler';
import AsbplayerHeartbeatHandler from './handlers/asbplayerv2/AsbplayerHeartbeatHandler';
import RefreshSettingsHandler from './handlers/popup/RefreshSettingsHandler';
import { CommandHandler } from './handlers/CommandHandler';
import {
    Command,
    CopySubtitleMessage,
    ExtensionToVideoCommand,
    Message,
    PostMineAction,
    TakeScreenshotMessage,
    ToggleRecordingMessage,
} from '@project/common';
import TakeScreenshotHandler from './handlers/video/TakeScreenshotHandler';
import BackgroundPageAudioRecorder from './services/BackgroundPageAudioRecorder';
import BackgroundPageReadyHandler from './handlers/backgroundpage/BackgroundPageReadyHandler';
import AudioBase64Handler from './handlers/backgroundpage/AudioBase64Handler';
import AckTabsHandler from './handlers/asbplayerv2/AckTabsHandler';
import VersionChecker from './services/VersionChecker';
import OpenExtensionShortcutsHandler from './handlers/asbplayerv2/OpenExtensionShortcutsHandler';
import EditKeyboardShortcutsHandler from './handlers/popup/EditKeyboardShortcutsHandler';
import ExtensionCommandsHandler from './handlers/asbplayerv2/ExtensionCommandsHandler';
import OpenAsbplayerSettingsHandler from './handlers/video/OpenAsbplayerSettingsHandler';

const settings = new Settings();
const versionChecker = new VersionChecker(settings);

chrome.runtime.onStartup.addListener(async () => {
    const [newVersionAvailable] = await versionChecker.newVersionAvailable();

    if (newVersionAvailable === true) {
        await chrome.action.setBadgeBackgroundColor({ color: 'red' });
        await chrome.action.setBadgeText({ text: '!' });
    }
});

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
    new VideoToAsbplayerCommandForwardingHandler(tabRegistry),
    new AsbplayerToVideoCommandForwardingHandler(),
    new AsbplayerHeartbeatHandler(tabRegistry),
    new AckTabsHandler(tabRegistry),
    new OpenExtensionShortcutsHandler(),
    new ExtensionCommandsHandler(),
    new AsbplayerV2ToVideoCommandForwardingHandler(),
    new RefreshSettingsHandler(tabRegistry),
    new BackgroundPageReadyHandler(backgroundPageAudioRecorder),
    new AudioBase64Handler(backgroundPageAudioRecorder),
    new EditKeyboardShortcutsHandler(tabRegistry),
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
                        chrome.tabs.sendMessage(tab.id, {
                            sender: 'asbplayer-extension-to-video',
                            message: {
                                command: 'toggle-video-select',
                            },
                        });
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
