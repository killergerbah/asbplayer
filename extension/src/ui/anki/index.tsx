import '@fontsource/roboto';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Bridge from '../bridge';
import AnkiUi from '../components/AnkiUi';

export function renderAnkiUi(element: Element, mp3WorkerUrl: string) {
    const bridge = new Bridge();
    createRoot(element).render(<AnkiUi bridge={bridge} mp3WorkerUrl={mp3WorkerUrl} />);
    return bridge;
}
