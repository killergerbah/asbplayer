import '@fontsource/roboto';
import React from 'react';
import { render } from 'react-dom';
import AnkiUi from './components/AnkiUi';
import VideoNameUi from './components/VideoNameUi';
import Bridge from './Bridge';

export function renderAnkiUi(element, mp3WorkerUrl) {
    const bridge = new Bridge();
    render(<AnkiUi bridge={bridge} mp3WorkerUrl={mp3WorkerUrl} />, element);
    return bridge;
}

export function renderVideoNameUi(element) {
    const bridge = new Bridge();
    render(<VideoNameUi bridge={bridge} />, element);
    return bridge;
}
