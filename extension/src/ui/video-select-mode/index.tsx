import '@fontsource/roboto';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Bridge from '../Bridge';
import VideoSelectModeUi from '../components/VideoSelectModeUi';

export function renderVideoSelectModeUi(element: Element) {
    const bridge = new Bridge();
    createRoot(element).render(<VideoSelectModeUi bridge={bridge} />);
    return bridge;
}
