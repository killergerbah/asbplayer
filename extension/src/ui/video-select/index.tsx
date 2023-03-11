import '@fontsource/roboto';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Bridge from '../Bridge';
import VideoSelectUi from '../components/VideoSelectUi';

export function renderVideoSelectModeUi(element: Element) {
    const bridge = new Bridge();
    createRoot(element).render(<VideoSelectUi bridge={bridge} />);
    return bridge;
}
