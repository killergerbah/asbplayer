import '@fontsource/roboto';
import React from 'react';
import { render } from 'react-dom';
import Bridge from '../Bridge';
import PopupUi from '../components/PopupUi';

export function renderPopupUi(element, { currentSettings, commands }) {
    const bridge = new Bridge();
    render(<PopupUi bridge={bridge} currentSettings={currentSettings} commands={commands} />, element);
    return bridge;
}
