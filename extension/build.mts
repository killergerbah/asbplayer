import { loadEnv, build, UserConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import glob from 'glob';

const manifestWithoutLocalhostPatterns = (manifest) => {
    const modifiedContentScripts = manifest.content_scripts.map((originalContentScript) => ({
        ...originalContentScript,
        exclude_globs: originalContentScript.exclude_globs?.filter((pattern) => !pattern.includes('localhost')),
        matches: originalContentScript.matches?.filter((pattern) => !pattern.includes('localhost')),
    }));
    return { ...manifest, content_scripts: modifiedContentScripts };
};

const manifestModifiedForFirefoxAndroid = (manifest) => {
    delete manifest['commands'];
    return {
        ...manifestModifiedForFirefox(manifest),
        permissions: ['tabs', 'storage', 'webRequest', 'webRequestBlocking'],
        browser_specific_settings: {
            gecko: {
                id: '{49de9206-c73e-4829-be4d-bda770d7f4b5}',
            },
            gecko_android: {},
        },
    };
};

const manifestModifiedForFirefox = (manifest) => {
    delete manifest['minimum_chrome_version'];
    delete manifest['key'];
    delete manifest['side_panel'];
    return {
        ...manifest,
        host_permissions: ['<all_urls>'],
        permissions: ['tabs', 'storage', 'contextMenus', 'webRequest', 'webRequestBlocking'],
        background: {
            scripts: ['background.js'],
            type: 'module',
        },
        browser_specific_settings: {
            gecko: {
                id: '{e4b27483-2e73-4762-b2ec-8d988a143a40}',
                update_url: 'https://killergerbah.github.io/asbplayer/firefox-extension-updates.json',
            },
        },
    };
};

const modifyManifest = (content, target, mode) => {
    let manifest = JSON.parse(content.toString());

    if (target === 'firefox') {
        manifest = manifestModifiedForFirefox(manifest);
    }

    if (target === 'firefoxandroid') {
        manifest = manifestModifiedForFirefoxAndroid(manifest);
    }

    if (mode === 'production') {
        manifest = manifestWithoutLocalhostPatterns(manifest);
    }

    return JSON.stringify(manifest);
};

const mode: string = process.argv[2] || 'development';
const env = loadEnv(mode, process.cwd());
const target = env.VITE_BUILD_TARGET || 'chromium';

const configForNonModuleEntryPoint = (name: string, path: string, index: number): UserConfig => {
    const config: UserConfig = {
        mode,
        build: {
            outDir: `dist/${target}`,
            emptyOutDir: index === 0,
            minify: mode === 'production',
            sourcemap: true,
            rollupOptions: {
                output: {
                    entryFileNames: '[name].js',
                    chunkFileNames: '[name].js',
                    assetFileNames: 'assets/[name].[ext]',
                    format: 'iife',
                },
                input: { [name]: path },
            },
        },
    };

    if (index === 0) {
        config.plugins = [
            viteStaticCopy({
                targets: [
                    {
                        src: '../common/locales/*',
                        dest: 'asbplayer-locales',
                    },
                    {
                        src: './src/manifest.json',
                        dest: '',
                        transform: (content, path) => modifyManifest(content, target, mode),
                    },
                    {
                        src: 'src/assets/*',
                        dest: 'assets',
                    },
                    {
                        src: 'src/_locales/*',
                        dest: '_locales',
                    },
                    {
                        src: ['src/*.css', 'src/*.html'],
                        dest: '',
                    },
                ],
            }),
        ];
    }

    return config;
};

const configForModuleEntryPoints = (entryPonts: { [name: string]: string }): UserConfig => {
    return {
        mode,
        build: {
            outDir: `dist/${target}`,
            emptyOutDir: false,
            minify: mode === 'production',
            sourcemap: true,
            rollupOptions: {
                output: {
                    entryFileNames: '[name].js',
                    chunkFileNames: 'chunks/[name].js',
                    assetFileNames: 'assets/[name].[ext]',
                    format: 'es',
                },
                input: entryPonts,
            },
        },
    };
};

const moduleEntryPoints = {
    background: './src/background.ts',
    'side-panel': './src/side-panel.ts',
    'settings-ui': './src/settings-ui.ts',
    'popup-ui': './src/popup-ui.ts',
    'anki-ui': './src/anki-ui.ts',
    'video-data-sync-ui': './src/video-data-sync-ui.ts',
    'video-select-ui': './src/video-select-ui.ts',
    'ftue-ui': './src/ftue-ui.ts',
    'mobile-video-overlay-ui': './src/mobile-video-overlay-ui.ts',
    'notification-ui': './src/notification-ui.ts',
    'offscreen-audio-recorder': './src/offscreen-audio-recorder.ts',
};

const nonModuleEntryPoints = {
    ...Object.fromEntries(
        glob
            .sync('./src/pages/*.ts')
            .filter((p) => p !== './src/pages/util.ts')
            .map((filePath) => [filePath.substring(filePath.lastIndexOf('/pages') + 1, filePath.length - 3), filePath])
    ),
    'mp3-encoder-worker': '../common/audio-clip/mp3-encoder-worker.ts',
    'pgs-parser-worker': '../common/subtitle-reader/pgs-parser-worker.ts',
    video: './src/video.ts',
    page: './src/page.ts',
    asbplayer: './src/asbplayer.ts',
};

const entries = Object.entries(nonModuleEntryPoints);
const firstEntry = entries[0];

// Build first entry-point synchronously so that dist/ is cleaned out completely
await build(configForNonModuleEntryPoint(firstEntry[0], firstEntry[1], 0));

// Build the rest
const promises: Promise<any>[] = [];

for (let index = 1; index < entries.length; ++index) {
    const [name, path] = entries[index];
    promises.push(build(configForNonModuleEntryPoint(name, path, index)));
}

// Build module entry points in single batch
promises.push(build(configForModuleEntryPoints(moduleEntryPoints)));
await Promise.all(promises);
