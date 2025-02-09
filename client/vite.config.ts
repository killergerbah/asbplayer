import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import { createHtmlPlugin } from 'vite-plugin-html';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd());
    return {
        base: env.VITE_APP_BASE_PATH || '/asbplayer',
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
            open: true,
            port: 3000,
        },
    };
});
