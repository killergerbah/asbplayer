import '@fontsource/roboto';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Bridge from '../Bridge';
import VideoOverlayUi from '../components/VideoOverlayUi';

export function renderVideoOverlayUi(element: Element) {
    const bridge = new Bridge();
    createRoot(element).render(<VideoOverlayUi bridge={bridge} />);
    return bridge;
}
