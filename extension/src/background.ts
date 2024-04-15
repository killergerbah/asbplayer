import TabRegistry, { Asbplayer } from './services/tab-registry';
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
import AudioRecorderService from './services/audio-recorder-service';
import AudioBase64Handler from './handlers/offscreen-document/audio-base-64-handler';
import AckTabsHandler from './handlers/asbplayerv2/ack-tabs-handler';
import OpenExtensionShortcutsHandler from './handlers/asbplayerv2/open-extension-shortcuts-handler';
import ExtensionCommandsHandler from './handlers/asbplayerv2/extension-commands-handler';
import OpenAsbplayerSettingsHandler from './handlers/video/open-asbplayer-settings-handler';
import CaptureVisibleTabHandler from './handlers/foreground/capture-visible-tab-handler';
import CopyToClipboardHandler from './handlers/video/copy-to-clipboard-handler';
import SettingsUpdatedHandler from './handlers/asbplayerv2/settings-updated-handler';
import {
    Command,
    CopySubtitleMessage,
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    Message,
    PostMineAction,
    TakeScreenshotMessage,
    ToggleRecordingMessage,
    ToggleVideoSelectMessage,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { fetchSupportedLanguages, primeLocalization } from './services/localization-fetcher';
import VideoDisappearedHandler from './handlers/video/video-disappeared-handler';
import { ExtensionSettingsStorage } from './services/extension-settings-storage';
import LoadSubtitlesHandler from './handlers/asbplayerv2/load-subtitles-handler';
import ToggleSidePanelHandler from './handlers/video/toggle-side-panel-handler';
import CopySubtitleHandler from './handlers/asbplayerv2/copy-subtitle-handler';
import { RequestingActiveTabPermissionHandler } from './handlers/video/requesting-active-tab-permission';
import { CardPublisher } from './services/card-publisher';
import AckMessageHandler from './handlers/video/ack-message-handler';
import PublishCardHandler from './handlers/asbplayerv2/publish-card-handler';
import { bindWebSocketClient, unbindWebSocketClient } from './services/web-socket-client-binding';
import { isFirefox } from './services/browser-detection';
import { CaptureStreamAudioRecorder, OffscreenAudioRecorder } from './services/audio-recorder-delegate';
import RequestModelHandler from './handlers/mobile-overlay/request-model-handler';
import CurrentTabHandler from './handlers/mobile-overlay/current-tab-handler';
import UpdateMobileOverlayModelHandler from './handlers/video/update-mobile-overlay-model-handler';
import { isMobile } from './services/device-detection';

if (!isFirefox) {
    chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
}

const settings = new SettingsProvider(new ExtensionSettingsStorage());

const startListener = async () => {
    primeLocalization(await settings.getSingle('language'));
};

const installListener = async (details: chrome.runtime.InstalledDetails) => {
    if (details.reason !== chrome.runtime.OnInstalledReason.INSTALL) {
        return;
    }

    const defaultUiLanguage = chrome.i18n.getUILanguage();
    const supportedLanguages = await fetchSupportedLanguages();

    if (supportedLanguages.includes(defaultUiLanguage)) {
        await settings.set({ language: defaultUiLanguage });
        primeLocalization(defaultUiLanguage);
    }

    if (isMobile) {
        // Set reasonable defaults for mobile
        await settings.set({
            streamingTakeScreenshot: false, // Kiwi Browser does not support captureVisibleTab
            subtitleSize: 18,
            subtitlePositionOffset: 25,
        });
    }

    chrome.tabs.create({ url: chrome.runtime.getURL('ftue-ui.html'), active: true });
};

chrome.runtime.onInstalled.addListener(installListener);
chrome.runtime.onStartup.addListener(startListener);

const tabRegistry = new TabRegistry(settings);
const audioRecorder = new AudioRecorderService(
    tabRegistry,
    isFirefox ? new CaptureStreamAudioRecorder() : new OffscreenAudioRecorder()
);
const imageCapturer = new ImageCapturer(settings);
const cardPublisher = new CardPublisher(settings);

const handlers: CommandHandler[] = [
    new VideoHeartbeatHandler(tabRegistry),
    new RecordMediaHandler(audioRecorder, imageCapturer, cardPublisher, settings),
    new RerecordMediaHandler(settings, audioRecorder, cardPublisher),
    new StartRecordingMediaHandler(audioRecorder, imageCapturer, cardPublisher),
    new StopRecordingMediaHandler(audioRecorder, imageCapturer, cardPublisher, settings),
    new TakeScreenshotHandler(imageCapturer, cardPublisher),
    new ToggleSubtitlesHandler(settings, tabRegistry),
    new SyncHandler(tabRegistry),
    new HttpPostHandler(),
    new ToggleSidePanelHandler(tabRegistry),
    new OpenAsbplayerSettingsHandler(),
    new CopyToClipboardHandler(),
    new VideoDisappearedHandler(tabRegistry),
    new RequestingActiveTabPermissionHandler(),
    new CopySubtitleHandler(tabRegistry),
    new LoadSubtitlesHandler(tabRegistry),
    new PublishCardHandler(cardPublisher),
    new AckMessageHandler(tabRegistry),
    new AudioBase64Handler(audioRecorder),
    new UpdateMobileOverlayModelHandler(),
    new VideoToAsbplayerCommandForwardingHandler(tabRegistry),
    new AsbplayerToVideoCommandForwardingHandler(),
    new AsbplayerHeartbeatHandler(tabRegistry),
    new AckTabsHandler(tabRegistry),
    new SettingsUpdatedHandler(tabRegistry, settings),
    new OpenExtensionShortcutsHandler(),
    new ExtensionCommandsHandler(),
    new AsbplayerV2ToVideoCommandForwardingHandler(),
    new RefreshSettingsHandler(tabRegistry, settings),
    new CaptureVisibleTabHandler(),
    new RequestModelHandler(),
    new CurrentTabHandler(),
];

chrome.runtime.onMessage.addListener((request: Command<Message>, sender, sendResponse) => {
    for (const handler of handlers) {
        if (
            (typeof handler.sender === 'string' && handler.sender === request.sender) ||
            (typeof handler.sender === 'object' && handler.sender.includes(request.sender))
        ) {
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
    chrome.contextMenus?.create({
        id: 'load-subtitles',
        title: chrome.i18n.getMessage('contextMenuLoadSubtitles'),
        contexts: ['page', 'video'],
    });

    chrome.contextMenus?.create({
        id: 'mine-subtitle',
        title: chrome.i18n.getMessage('contextMenuMineSubtitle'),
        contexts: ['page', 'video'],
    });
});

chrome.contextMenus?.onClicked.addListener((info) => {
    if (info.menuItemId === 'load-subtitles') {
        const toggleVideoSelectCommand: ExtensionToVideoCommand<ToggleVideoSelectMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'toggle-video-select',
            },
        };
        tabRegistry.publishCommandToVideoElementTabs((tab): ExtensionToVideoCommand<Message> | undefined => {
            if (info.pageUrl !== tab.url) {
                return undefined;
            }

            return toggleVideoSelectCommand;
        });
    } else if (info.menuItemId === 'mine-subtitle') {
        tabRegistry.publishCommandToVideoElements((videoElement): ExtensionToVideoCommand<Message> | undefined => {
            if (info.srcUrl !== undefined && videoElement.src !== info.srcUrl) {
                return undefined;
            }

            if (info.srcUrl === undefined && info.pageUrl !== videoElement.tab.url) {
                return undefined;
            }

            const copySubtitleCommand: ExtensionToVideoCommand<CopySubtitleMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'copy-subtitle',
                    postMineAction: PostMineAction.showAnkiDialog,
                },
                src: videoElement.src,
            };
            return copySubtitleCommand;
        });
    }
});

chrome.commands?.onCommand.addListener((command) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const validAsbplayer = (asbplayer: Asbplayer) => {
            if (asbplayer.sidePanel) {
                return false;
            }

            const tab = asbplayer.tab;

            if (tab && tabs.find((t) => t.id === tab.id) === undefined) {
                return false;
            }

            return true;
        };

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

                tabRegistry.publishCommandToAsbplayers({
                    commandFactory: (asbplayer) => {
                        if (!validAsbplayer(asbplayer)) {
                            return undefined;
                        }

                        const extensionToPlayerCommand: ExtensionToAsbPlayerCommand<CopySubtitleMessage> = {
                            sender: 'asbplayer-extension-to-player',
                            message: {
                                command: 'copy-subtitle',
                                postMineAction: postMineAction,
                            },
                            asbplayerId: asbplayer.id,
                        };
                        return extensionToPlayerCommand;
                    },
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

                tabRegistry.publishCommandToAsbplayers({
                    commandFactory: (asbplayer) => {
                        if (!validAsbplayer(asbplayer)) {
                            return undefined;
                        }

                        const extensionToPlayerCommand: Command<TakeScreenshotMessage> = {
                            sender: 'asbplayer-extension-to-player',
                            message: {
                                command: 'take-screenshot',
                            },
                        };
                        return extensionToPlayerCommand;
                    },
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

const updateWebSocketClientState = () => {
    settings.getSingle('webSocketClientEnabled').then((webSocketClientEnabled) => {
        if (webSocketClientEnabled) {
            bindWebSocketClient(settings, tabRegistry);
        } else {
            unbindWebSocketClient();
        }
    });
};

updateWebSocketClientState();
tabRegistry.onAsbplayerInstance(updateWebSocketClientState);
tabRegistry.onSyncedElement(updateWebSocketClientState);

const defaultAction = (tab: chrome.tabs.Tab) => {
    if (isMobile) {
        if (tab.id !== undefined) {
            const extensionToVideoCommand: ExtensionToVideoCommand<ToggleVideoSelectMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'toggle-video-select',
                },
            };
            chrome.tabs.sendMessage(tab.id, extensionToVideoCommand);
        }
    } else {
        chrome.action.openPopup();
    }
};

if (isFirefox) {
    let hasHostPermission = true;

    chrome.permissions.contains({ origins: ['<all_urls>'] }).then((result) => {
        hasHostPermission = result;

        if (hasHostPermission && !isMobile) {
            chrome.action.setPopup({
                popup: 'popup-ui.html',
            });
        }
    });

    chrome.action.onClicked.addListener(async (tab) => {
        if (hasHostPermission) {
            defaultAction(tab);
        } else {
            try {
                const obtainedHostPermission = await chrome.permissions.request({ origins: ['<all_urls>'] });

                if (obtainedHostPermission) {
                    hasHostPermission = true;
                    chrome.runtime.reload();
                }
            } catch (e) {
                console.error(e);
            }
        }
    });
} else {
    chrome.action.setPopup({
        popup: 'popup-ui.html',
    });
    chrome.action.onClicked.addListener(defaultAction);
}

if (isFirefox) {
    // Firefox requires the use of iframe.srcdoc in order to load UI into an about:blank iframe
    // (which is required for UI to be scannable by other extensions like Yomitan).
    // However, such an iframe inherits the content security directives of the parent document,
    // which may prevent loading of extension scripts into the iframe.
    // Because of this, we modify CSP headers below to explicitly allow access to extension-packaged resources.
    chrome.webRequest.onHeadersReceived.addListener(
        (details) => {
            const responseHeaders = details.responseHeaders;

            if (!responseHeaders) {
                return;
            }

            for (const header of responseHeaders) {
                if (header.name.toLowerCase() === 'content-security-policy') {
                    let cspValue = header.value;
                    cspValue += ` ; script-src moz-extension://${chrome.runtime.id}`;
                }
            }

            return { responseHeaders };
        },
        { urls: ['<all_urls>'] },
        ['blocking', 'responseHeaders']
    );
}
