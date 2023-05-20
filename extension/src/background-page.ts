import {
    StartRecordingAudioWithTimeoutMessage,
    StopRecordingAudioMessage,
    BackgroundPageToExtensionCommand,
    BackgroundPageReadyMessage,
    AudioBase64Message,
} from '@project/common';
import { Mp3Encoder } from '@project/common';
import AudioRecorder from './services/audio-recorder';
import { bufferToBase64 } from './services/base64';
import { i18nInit } from './ui/i18n';
import i18n from 'i18next';
import Settings from './services/settings';
import { fetchLocalization } from './services/localization-fetcher';

const settings = new Settings();
const audioRecorder = new AudioRecorder();

const _sendAudioBase64 = async (base64: string, preferMp3: boolean) => {
    if (preferMp3) {
        const blob = await (await fetch('data:audio/webm;base64,' + base64)).blob();
        const mp3Blob = await Mp3Encoder.encode(
            blob,
            () => new Worker(chrome.runtime.getURL('./mp3-encoder-worker.worker.js'))
        );
        base64 = bufferToBase64(await mp3Blob.arrayBuffer());
    }

    const command: BackgroundPageToExtensionCommand<AudioBase64Message> = {
        sender: 'asbplayer-background-page',
        message: {
            command: 'audio-base64',
            base64: base64,
        },
    };

    chrome.runtime.sendMessage(command);
};

window.onload = async () => {
    const listener = async (
        request: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => {
        if (request.sender === 'asbplayer-extension-to-background-page') {
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
    };
    chrome.runtime.onMessage.addListener(listener);

    window.addEventListener('beforeunload', (event) => {
        chrome.runtime.onMessage.removeListener(listener);
    });

    const readyCommand: BackgroundPageToExtensionCommand<BackgroundPageReadyMessage> = {
        sender: 'asbplayer-background-page',
        message: {
            command: 'background-page-ready',
        },
    };
    const acked = await chrome.runtime.sendMessage(readyCommand);

    if (!acked) {
        window.close();
    }

    const language = await settings.getSingle('lastLanguage');
    const loc = await fetchLocalization(language);
    i18nInit(loc.lang, loc.strings);
    document.getElementById('helper-text')!.innerHTML = i18n.t('extension.backgroundAudioRecordingPage.description');
};
