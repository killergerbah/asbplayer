import '@fontsource/roboto';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Bridge from '../Bridge';
import VideoDataSyncUi from '../components/VideoDataSyncUi';

export function renderVideoDataSyncUi(element: Element) {
    const bridge = new Bridge();
    createRoot(element).render(<VideoDataSyncUi bridge={bridge} />);
    return bridge;
}
