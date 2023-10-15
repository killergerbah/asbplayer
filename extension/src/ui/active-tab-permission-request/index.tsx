import React from 'react';
import { createRoot } from 'react-dom/client';
import Bridge from '../bridge';
import { i18nInit } from '../i18n';
import ActiveTabPermissionRequestUi from '../components/ActiveTabPermissionRequestUi';

export function renderActiveTabPermissionRequestUi(element: Element, language: string, locStrings: any) {
    const bridge = new Bridge();
    i18nInit(language, locStrings);
    createRoot(element).render(<ActiveTabPermissionRequestUi bridge={bridge} />);
    return bridge;
}
