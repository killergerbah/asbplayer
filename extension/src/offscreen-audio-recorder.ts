import {
    StartRecordingAudioWithTimeoutMessage,
    StopRecordingAudioMessage,
    AudioBase64Message,
    StartRecordingAudioMessage,
    OffscreenDocumentToExtensionCommand,
} from '@project/common';
import AudioRecorder from './services/audio-recorder';
import { bufferToBase64 } from './services/base64';
import { Mp3Encoder } from '@project/common/audio-clip';

const audioRecorder = new AudioRecorder();

const _sendAudioBase64 = async (base64: string, preferMp3: boolean) => {
    if (preferMp3) {
        const blob = await (await fetch('data:audio/webm;base64,' + base64)).blob();
        const mp3Blob = await Mp3Encoder.encode(
            blob,
            () => new Worker(new URL('../../common/audio-clip/mp3-encoder-worker.ts', import.meta.url))
        );
        base64 = bufferToBase64(await mp3Blob.arrayBuffer());
    }

    const command: OffscreenDocumentToExtensionCommand<AudioBase64Message> = {
        sender: 'asbplayer-offscreen-document',
        message: {
            command: 'audio-base64',
            base64: base64,
        },
    };

    chrome.runtime.sendMessage(command);
};

window.onload = async () => {
    const listener = (request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
        if (request.sender === 'asbplayer-extension-to-offscreen-document') {
            switch (request.message.command) {
                case 'start-recording-audio-with-timeout':
                    const startRecordingAudioWithTimeoutMessage =
                        request.message as StartRecordingAudioWithTimeoutMessage;
                    audioRecorder
                        .startWithTimeout(
                            startRecordingAudioWithTimeoutMessage.streamId,
                            startRecordingAudioWithTimeoutMessage.timeout,
                            () => sendResponse(true)
                        )
                        .then((audioBase64) =>
                            _sendAudioBase64(audioBase64, startRecordingAudioWithTimeoutMessage.preferMp3)
                        )
                        .catch((e) => {
                            console.error(e instanceof Error ? e.message : String(e));
                            sendResponse(false);
                        });
                    return true;
                case 'start-recording-audio':
                    const startRecordingAudioMessage = request.message as StartRecordingAudioMessage;
                    audioRecorder
                        .start(startRecordingAudioMessage.streamId)
                        .then(() => sendResponse(true))
                        .catch((e) => {
                            console.error(e);
                            sendResponse(false);
                        });
                    return true;
                case 'stop-recording-audio':
                    const stopRecordingAudioMessage = request.message as StopRecordingAudioMessage;
                    audioRecorder
                        .stop()
                        .then((audioBase64) => _sendAudioBase64(audioBase64, stopRecordingAudioMessage.preferMp3));
                    break;
            }
        }
    };
    chrome.runtime.onMessage.addListener(listener);

    window.addEventListener('beforeunload', (event) => {
        chrome.runtime.onMessage.removeListener(listener);
    });
};
