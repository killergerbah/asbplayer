import '@fontsource/roboto';

import React from 'react';
import { render } from 'react-dom';

import Bridge from './Bridge';
import AnkiUi from './components/AnkiUi';
import SubtitleSyncUI from './components/SubtitleSyncUI';
import VideoNameUi from './components/VideoNameUi';

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

export function renderSubtitleSyncUi(element) {
    const bridge = new Bridge();
    render(<SubtitleSyncUI bridge={bridge} />, element);
    return bridge;
}
