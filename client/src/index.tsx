import '@fontsource/roboto';
import { createRoot } from 'react-dom/client';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import { LocalSettingsStorage } from './local-settings-storage';
import { RootApp } from '@project/common/app';
import { HttpFetcher } from '@project/common';

const fetcher = new HttpFetcher();

createRoot(document.querySelector('#root')!).render(
    <BrowserRouter basename={process.env.PUBLIC_URL}>
        <RootApp
            origin={process.env.PUBLIC_URL}
            logoUrl={`${process.env.PUBLIC_URL}/background-colored.png`}
            settingsStorage={new LocalSettingsStorage()}
            fetcher={fetcher}
        />
    </BrowserRouter>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
