import {
    StartRecordingAudioWithTimeoutMessage,
    StopRecordingAudioMessage,
    OptionsPageToExtensionCommand,
    OptionsPageReadyMessage,
    AudioBase64Message,
} from '@project/common';
import Mp3Encoder from '@project/common/src/Mp3Encoder';
import AudioRecorder from './services/AudioRecorder';
import { bufferToBase64 } from './services/Base64';

const audioRecorder = new AudioRecorder();

const _sendAudioBase64 = async (base64: string, preferMp3: boolean) => {
    if (preferMp3) {
        const blob = await (await fetch('data:audio/webm;base64,' + base64)).blob();
        const mp3Blob = await Mp3Encoder.encode(
            blob,
            () => new Worker(chrome.runtime.getURL('./mp3-encoder.worker.js'))
        );
        base64 = bufferToBase64(await mp3Blob.arrayBuffer());
    }

    const command: OptionsPageToExtensionCommand<AudioBase64Message> = {
        sender: 'asbplayer-options-page',
        message: {
            command: 'audio-base64',
            base64: base64,
        },
    };
    
    chrome.runtime.sendMessage(command);
};

window.onload = () => {
    chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
        if (request.sender === 'asbplayer-extension-to-options-page') {
            switch (request.message.command) {
                case 'start-recording-audio-with-timeout':
                    const startRecordingAudioWithTimeoutMessage =
                        request.message as StartRecordingAudioWithTimeoutMessage;
                    _sendAudioBase64(
                        await audioRecorder.startWithTimeout(startRecordingAudioWithTimeoutMessage.timeout),
                        startRecordingAudioWithTimeoutMessage.preferMp3
                    );
                    break;
                case 'start-recording-audio':
                    audioRecorder.start();
                    break;
                case 'stop-recording-audio':
                    const stopRecordingAudioMessage = request.message as StopRecordingAudioMessage;
                    _sendAudioBase64(await audioRecorder.stop(), stopRecordingAudioMessage.preferMp3);
            }
        }
    });

    const readyCommand: OptionsPageToExtensionCommand<OptionsPageReadyMessage> = {
        sender: 'asbplayer-options-page',
        message: {
            command: 'options-page-ready',
        },
    };
    chrome.runtime.sendMessage(readyCommand);
};
