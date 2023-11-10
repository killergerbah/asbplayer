import '@fontsource/roboto';
import { createRoot } from 'react-dom/client';
import reportWebVitals from './reportWebVitals';
import { HttpFetcher } from '@project/common';
import WebsiteApp from './components/WebsiteApp';

const fetcher = new HttpFetcher();

createRoot(document.querySelector('#root')!).render(
    <WebsiteApp
        origin={process.env.PUBLIC_URL}
        logoUrl={`${process.env.PUBLIC_URL}/background-colored.png`}
        fetcher={fetcher}
    />
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
