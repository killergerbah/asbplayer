import '@fontsource/roboto';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Bridge from '../bridge';
import { PopupUi } from '../components/PopupUi';
import { AsbplayerSettings } from '@project/common';

export interface PopupUiParameters {
    currentSettings: AsbplayerSettings;
    commands: any;
}

export async function renderPopupUi(element: Element, { commands }: PopupUiParameters) {
    const bridge = new Bridge();
    createRoot(element).render(<PopupUi bridge={bridge} commands={commands} />);
    return bridge;
}

export { SettingsChangedMessage, OpenExtensionShortcutsMessage } from '../components/PopupUi';
