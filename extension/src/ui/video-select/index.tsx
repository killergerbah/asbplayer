import '@fontsource/roboto';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Bridge from '../bridge';
import VideoSelectUi from '../components/VideoSelectUi';
import { i18nInit } from '../i18n';

export function renderVideoSelectModeUi(element: Element, language: string) {
    const bridge = new Bridge();
    i18nInit(language);
    createRoot(element).render(<VideoSelectUi bridge={bridge} />);
    return bridge;
}
