import '@fontsource/roboto';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Bridge from '../Bridge';
import PopupUi from '../components/PopupUi';

export interface PopupUiParameters {
    currentSettings: any;
    commands: any;
}

export function renderPopupUi(element: Element, { currentSettings, commands }: PopupUiParameters) {
    const bridge = new Bridge();
    createRoot(element).render(<PopupUi bridge={bridge} currentSettings={currentSettings} commands={commands} />);
    return bridge;
}
