import '@fontsource/roboto';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Bridge from '../bridge';
import VideoDataSyncUi from '../components/VideoDataSyncUi';

export function renderVideoDataSyncUi(element: Element) {
    const bridge = new Bridge();
    createRoot(element).render(<VideoDataSyncUi bridge={bridge} />);
    return bridge;
}
