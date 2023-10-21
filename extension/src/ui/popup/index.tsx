import '@fontsource/roboto';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PopupUi } from '../components/PopupUi';
import { AsbplayerSettings } from '@project/common';

export interface PopupUiParameters {
    currentSettings: AsbplayerSettings;
    commands: any;
}

export async function renderPopupUi(element: Element, { commands }: PopupUiParameters) {
    createRoot(element).render(<PopupUi commands={commands} />);
}

export { SettingsChangedMessage, OpenExtensionShortcutsMessage } from '../components/PopupUi';
