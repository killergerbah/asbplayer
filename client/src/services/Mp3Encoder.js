// eslint-disable-next-line
import Worker from 'worker-loader!./mp3-encoder-worker.js';

const audioContext = new AudioContext();

export default class Mp3Encoder {

    static async encode(blob) {
        return new Promise(async (resolve, reject) => {
            var reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const audioBuffer = await audioContext.decodeAudioData(e.target.result);
                    const channels = [];

                    for (let i = 0; i < audioBuffer.numberOfChannels; ++i) {
                        channels.push(audioBuffer.getChannelData(i));
                    }

                    const worker = new Worker();
                    worker.postMessage({
                        command: 'encode',
                        audioBuffer: {
                            channels: channels,
                            numberOfChannels: audioBuffer.numberOfChannels,
                            length: audioBuffer.length,
                            sampleRate: audioBuffer.sampleRate,
                        }
                    });
                    worker.onmessage = (e) => {
                        resolve(new Blob(e.data.buffer, {type: 'audio/mp3'}));
                        worker.terminate();
                    };
                    worker.onerror = () => {
                        reject('MP3 encoding failed');
                        worker.terminate();
                    };
                } catch (e) {
                    reject(e);
                }
            };
            reader.readAsArrayBuffer(blob);
        });
    }
}