import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { createRoot } from 'react-dom/client';
import { HttpFetcher } from '@project/common';
import WebsiteApp from './components/WebsiteApp';

const fetcher = new HttpFetcher();

createRoot(document.querySelector('#root')!).render(
    <WebsiteApp
        origin={import.meta.env.PUBLIC_URL}
        logoUrl={`${import.meta.env.PUBLIC_URL}/background-colored.png`}
        fetcher={fetcher}
    />
);
