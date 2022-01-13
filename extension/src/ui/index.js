import '@fontsource/roboto';

import React from 'react';
import { render } from 'react-dom';

import Bridge from './Bridge';
import AnkiUi from './components/AnkiUi';
import VideoDataSyncUi from './components/VideoDataSyncUi';

export function renderAnkiUi(element, mp3WorkerUrl) {
    const bridge = new Bridge();
    render(<AnkiUi bridge={bridge} mp3WorkerUrl={mp3WorkerUrl} />, element);
    return bridge;
}

export function renderVideoDataSyncUi(element) {
    const bridge = new Bridge();
    render(<VideoDataSyncUi bridge={bridge} />, element);
    return bridge;
}
