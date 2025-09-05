import {
    AsbPlayerToVideoCommand,
    Command,
    CopySubtitleMessage,
    ExtensionToVideoCommand,
    Message,
} from '@project/common';
import TabRegistry from '../../services/tab-registry';

export default class CopySubtitleHandler {
    private readonly _tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this._tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'copy-subtitle';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const copySubtitleCommand = command as AsbPlayerToVideoCommand<CopySubtitleMessage>;
        this._tabRegistry.publishCommandToVideoElements(
            (videoElement): ExtensionToVideoCommand<Message> | undefined => {
                if (videoElement.src !== copySubtitleCommand.src || videoElement.tab.id !== copySubtitleCommand.tabId) {
                    return undefined;
                }

                const copySubtitleCommandToVideo: ExtensionToVideoCommand<CopySubtitleMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'copy-subtitle',
                        postMineAction: copySubtitleCommand.message.postMineAction,
                        subtitle: copySubtitleCommand.message.subtitle,
                        surroundingSubtitles: copySubtitleCommand.message.surroundingSubtitles,
                        exportMode: copySubtitleCommand.message.exportMode,
                    },
                    src: videoElement.src,
                };
                return copySubtitleCommandToVideo;
            }
        );
        return false;
    }
}
