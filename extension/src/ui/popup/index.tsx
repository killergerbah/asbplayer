import '@fontsource/roboto';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Bridge from '../bridge';
import { PopupUi } from '../components/PopupUi';
import { i18nInit } from '../components/i18n';

export interface PopupUiParameters {
    currentSettings: any;
    commands: any;
    language: string;
}

export async function renderPopupUi(element: Element, { currentSettings, commands, language }: PopupUiParameters) {
    await i18nInit(language);
    const bridge = new Bridge();
    createRoot(element).render(<PopupUi bridge={bridge} currentSettings={currentSettings} commands={commands} />);
    return bridge;
}

export { SettingsChangedMessage, OpenExtensionShortcutsMessage } from '../components/PopupUi';
