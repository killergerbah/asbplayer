import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import { createHtmlPlugin } from 'vite-plugin-html';

export default defineConfig(({ mode }) => {
    return {
        // depending on your application, base can also be "/"
        base: '/',
        plugins: [
            react(),
            viteTsconfigPaths(),
            createHtmlPlugin({
                inject: {
                    data: {
                        plausible:
                            mode === 'production'
                                ? '<script defer data-domain="killergerbah.github.io" src="https://plausible.io/js/script.js"></script>'
                                : '',
                    },
                },
            }),
        ],
        server: {
            // this ensures that the browser opens upon server start
            open: true,
            // this sets a default port to 3000
            port: 3000,
        },
    };
});
