import '@fontsource/roboto';
import { createRoot } from 'react-dom/client';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import { LocalSettingsStorage } from './local-settings-storage';
import { RootApp } from '@project/common/app';

createRoot(document.querySelector('#root')!).render(
    <BrowserRouter basename={process.env.PUBLIC_URL}>
        <RootApp settingsStorage={new LocalSettingsStorage()} />
    </BrowserRouter>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
