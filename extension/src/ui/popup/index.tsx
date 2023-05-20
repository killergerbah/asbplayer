import '@fontsource/roboto';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Bridge from '../bridge';
import { PopupUi } from '../components/PopupUi';
import { i18nInit } from '../i18n';
import { ExtensionSettings } from '@project/common';
import { fetchLocalization } from '../../services/localization-fetcher';

export interface PopupUiParameters {
    currentSettings: ExtensionSettings;
    commands: any;
}

export async function renderPopupUi(element: Element, { currentSettings, commands }: PopupUiParameters) {
    const loc = await fetchLocalization(currentSettings.lastLanguage);
    i18nInit(loc.lang, loc.strings);
    const bridge = new Bridge();
    createRoot(element).render(<PopupUi bridge={bridge} currentSettings={currentSettings} commands={commands} />);
    return bridge;
}

export { SettingsChangedMessage, OpenExtensionShortcutsMessage } from '../components/PopupUi';
