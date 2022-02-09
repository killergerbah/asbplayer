import '@fontsource/roboto';
import React from 'react';
import { render } from 'react-dom';
import Bridge from '../Bridge';
import VideoDataSyncUi from '../components/VideoDataSyncUi';

export function renderVideoDataSyncUi(element: Element) {
    const bridge = new Bridge();
    render(<VideoDataSyncUi bridge={bridge} />, element);
    return bridge;
}
