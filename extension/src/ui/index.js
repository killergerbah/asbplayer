import React from 'react';
import { render } from 'react-dom';
import AnkiUi from './components/AnkiUi';
import Bridge from './Bridge';

export function renderAnkiUi(element, mp3WorkerUrl) {
    const bridge = new Bridge();
    render(<AnkiUi bridge={bridge} mp3WorkerUrl={mp3WorkerUrl} />, element);
    return bridge;
}
