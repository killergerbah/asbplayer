import TabRegistry from './services/TabRegistry';
import Settings from './services/Settings';
import AudioRecorder from './services/AudioRecorder';
import ImageCapturer from './services/ImageCapturer';
import VideoHeartbeatHandler from './handlers/video/VideoHeartbeatHandler';
import RecordMediaHandler from './handlers/video/RecordMediaHandler';
import ToggleSubtitlesHandler from './handlers/video/ToggleSubtitlesHandler';
import SyncHandler from './handlers/video/SyncHandler';
import VideoToAsbplayerCommandForwardingHandler from './handlers/video/VideoToAsbplayerCommandForwardingHandler';
import AsbplayerToVideoCommandForwardingHandler from './handlers/asbplayer/AsbplayerToVideoCommandForwardingHandler';
import AsbplayerV2ToVideoCommandForwardingHandler from './handlers/asbplayerv2/AsbplayerV2ToVideoCommandForwardingHandler';
import AsbplayerHeartbeatHandler from './handlers/asbplayerv2/AsbplayerHeartbeatHandler';
import RefreshSettingsHandler from './handlers/popup/RefreshSettingsHandler';

const tabRegistry = new TabRegistry();
const settings = new Settings();
const handlers = [
    new VideoHeartbeatHandler(tabRegistry),
    new RecordMediaHandler(new AudioRecorder(), new ImageCapturer(settings)),
    new ToggleSubtitlesHandler(settings, tabRegistry),
    new SyncHandler(tabRegistry),
    new VideoToAsbplayerCommandForwardingHandler(),
    new AsbplayerToVideoCommandForwardingHandler(),
    new AsbplayerHeartbeatHandler(tabRegistry),
    new AsbplayerV2ToVideoCommandForwardingHandler(),
    new RefreshSettingsHandler(tabRegistry)
];

chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {
        for (const handler of handlers) {
            if (handler.sender === request.sender) {
                if (handler.command === null
                    || handler.command === request.message.command) {
                    handler.handle(request, sender);
                    break;
                }
            }
        }
    }
);

chrome.commands.onCommand.addListener((command) => {
    switch (command) {
        case 'copy-subtitle':
            tabRegistry.sendToActiveVideoElement({command: 'copy-subtitle'});
            break;
        case 'toggle-tab':
            tabRegistry.sendToActiveVideoElement({command: 'toggle-tab'});
            tabRegistry.sendToActiveAsbplayer({command: 'toggle-tab'});
            break;
        default:
            throw new Error('Unknown command ' + command);
    }
});
