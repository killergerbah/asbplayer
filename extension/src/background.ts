import TabRegistry from './services/TabRegistry';
import Settings from './services/Settings';
import AudioRecorder from './services/AudioRecorder';
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
import { Command, CopySubtitleMessage, ExtensionToVideoCommand, Message, TakeScreenshotMessage } from '@project/common';
import TakeScreenshotHandler from './handlers/video/TakeScreenshotHandler';

const settings = new Settings();
const tabRegistry = new TabRegistry(settings);
const audioRecorder = new AudioRecorder();
const imageCapturer = new ImageCapturer(settings);

const handlers: CommandHandler[] = [
    new VideoHeartbeatHandler(tabRegistry),
    new RecordMediaHandler(audioRecorder, imageCapturer),
    new RerecordMediaHandler(audioRecorder),
    new StartRecordingMediaHandler(audioRecorder, imageCapturer),
    new StopRecordingMediaHandler(audioRecorder, imageCapturer),
    new TakeScreenshotHandler(imageCapturer),
    new ToggleSubtitlesHandler(settings, tabRegistry),
    new SyncHandler(tabRegistry),
    new HttpPostHandler(),
    new VideoToAsbplayerCommandForwardingHandler(),
    new AsbplayerToVideoCommandForwardingHandler(),
    new AsbplayerHeartbeatHandler(tabRegistry),
    new AsbplayerV2ToVideoCommandForwardingHandler(),
    new RefreshSettingsHandler(tabRegistry),
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
    chrome.tabs.query({ active: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
            return;
        }

        switch (command) {
            case 'copy-subtitle':
            case 'copy-subtitle-with-dialog':
                _publishToVideoElements((id, src) => {
                    const extensionToVideoCommand: ExtensionToVideoCommand<CopySubtitleMessage> = {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'copy-subtitle',
                            showAnkiUi: command === 'copy-subtitle-with-dialog',
                        },
                        src: src,
                    };
                    return extensionToVideoCommand;
                }, tabs);
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
                _publishToVideoElements((id, src) => {
                    const extensionToVideoCommand: ExtensionToVideoCommand<TakeScreenshotMessage> = {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'take-screenshot',
                        },
                        src: src,
                    };
                    return extensionToVideoCommand;
                }, tabs);
            default:
                throw new Error('Unknown command ' + command);
        }
    });
});

function _publishToVideoElements(
    messageFunction: (id: number, src: string) => ExtensionToVideoCommand<Message>,
    tabs: chrome.tabs.Tab[]
) {
    for (const tab of tabs) {
        for (const id in tabRegistry.videoElements) {
            const videoElement = tabRegistry.videoElements[id];
            const videoElementTab = videoElement.tab;

            if (typeof videoElementTab.id !== 'undefined' && videoElementTab.id === tab.id) {
                chrome.tabs.sendMessage(videoElementTab.id, messageFunction(videoElementTab.id, videoElement.src));
            }
        }
    }
}