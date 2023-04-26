import '@fontsource/roboto';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Bridge from '../bridge';
import AnkiUi from '../components/AnkiUi';
import { i18nInit } from '../i18n';

export function renderAnkiUi(element: Element, mp3WorkerUrl: string, language: string) {
    const bridge = new Bridge();
    i18nInit(language);
    createRoot(element).render(<AnkiUi bridge={bridge} mp3WorkerUrl={mp3WorkerUrl} />);
    return bridge;
}
