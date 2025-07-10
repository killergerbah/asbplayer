import { defineConfig } from 'wxt';
import type { ResolvedPublicFile, UserManifest, Wxt } from 'wxt';
import fs from 'node:fs';
import path from 'node:path';

const commonAssets = [
    { srcDir: path.resolve(__dirname, '../common/locales'), destDir: 'asbplayer-locales' },
    { srcDir: path.resolve(__dirname, '../common/assets'), destDir: 'assets' },
];

const moveToPublicAssets = (srcPath: string, destPath: string, files: ResolvedPublicFile[]) => {
    const srcFiles = fs.readdirSync(srcPath);
    for (const file of srcFiles) {
        files.push({
            absoluteSrc: path.resolve(srcPath, file) as string,
            relativeDest: `${destPath}/${file}`,
        });
    }
};

const addToPublicPathsType = (srcPath: string, destPath: string, paths: string[]) => {
    const srcFiles = fs.readdirSync(srcPath);
    for (const file of srcFiles) {
        paths.push(`${destPath}/${file}`);
    }
};

// See https://wxt.dev/api/config.html
export default defineConfig({
    modules: ['@wxt-dev/module-react'],
    srcDir: 'src',
    zip: {
        sourcesRoot: '..',
        includeSources: ['.yarn/patches/**'],
    },
    hooks: {
        'build:publicAssets': (wxt: Wxt, files: ResolvedPublicFile[]) => {
            for (const { srcDir, destDir } of commonAssets) {
                moveToPublicAssets(srcDir, destDir, files);
                moveToPublicAssets(srcDir, destDir, files);
            }
        },
        'prepare:publicPaths': (wxt: Wxt, paths: string[]) => {
            for (const { srcDir, destDir } of commonAssets) {
                addToPublicPathsType(srcDir, destDir, paths);
            }
        },
    },
    manifest: ({ browser, mode }) => {
        let manifest: UserManifest = {
            name: 'asbplayer: Language-learning with subtitles',
            description: '__MSG_extensionDescription__',
            version: '1.11.0',
            action: { default_title: 'asbplayer' },
            default_locale: 'en',
            icons: {
                '16': 'icon/icon16.png',
                '48': 'icon/icon48.png',
                '128': 'icon/icon128.png',
            },
            web_accessible_resources: [
                {
                    resources: [
                        'chunks/*',
                        'fonts/*',
                        'asbplayer-locales/*',
                        'icon/image.png',
                        'netflix-page.js',
                        'youtube-page.js',
                        'tver-page.js',
                        'bandai-channel-page.js',
                        'amazon-prime-page.js',
                        'hulu-page.js',
                        'disney-plus-page.js',
                        'apps-disney-plus-page.js',
                        'viki-page.js',
                        'unext-page.js',
                        'emby-jellyfin-page.js',
                        'osnplus-page.js',
                        'bilibili-page.js',
                        'nrk-tv-page.js',
                        'plex-page.js',
                        'areena-yle-page.js',
                        'hbo-max-page.js',
                        'anki-ui.js',
                        'mp3-encoder-worker.js',
                        'pgs-parser-worker.js',
                        'video-data-sync-ui.js',
                        'video-select-ui.js',
                        'notification-ui.js',
                        'mobile-video-overlay-ui.html',
                    ],
                    matches: ['<all_urls>'],
                },
            ],
        };

        let commands: Browser.runtime.Manifest['commands'] = {
            'copy-subtitle': {
                description: '__MSG_shortcutMineSubtitleDescription__',
            },
            'copy-subtitle-with-dialog': {
                suggested_key: {
                    default: 'Ctrl+Shift+X',
                    mac: 'MacCtrl+Shift+X',
                },
                description: '__MSG_shortcutMineSubtitleAndOpenDialogDescription__',
            },
            'update-last-card': {
                suggested_key: {
                    default: 'Ctrl+Shift+U',
                    mac: 'MacCtrl+Shift+U',
                },
                description: '__MSG_shortcutUpdateLastCardDescription__',
            },
            'toggle-video-select': {
                suggested_key: {
                    default: 'Ctrl+Shift+F',
                    mac: 'MacCtrl+Shift+F',
                },
                description: '__MSG_shortcutSelectSubtitleTrackDescription__',
            },
            'export-card': {
                description: '__MSG_shortcutExportCardDescription__',
            },
            'take-screenshot': {
                suggested_key: {
                    default: 'Ctrl+Shift+V',
                    mac: 'MacCtrl+Shift+V',
                },
                description: '__MSG_shortcutTakeScreenshotDescription__',
            },
            'toggle-recording': {
                description: '__MSG_shortcutToggleRecordingDescription__',
            },
        };

        if (mode === 'development') {
            commands['wxt:reload-extension'] = {
                description: 'Reload the extension during development',
                // Normally there is a suggested key for this, but Chrome only supports up to 4 suggested keys.
                // suggested_key: {
                //     default: 'Alt+R',
                // },
            };
        }

        let permissions = ['tabs', 'storage'];

        if (browser === 'chrome') {
            permissions = [...permissions, 'tabCapture', 'activeTab', 'contextMenus', 'sidePanel', 'offscreen'];

            manifest = {
                ...manifest,
                minimum_chrome_version: '116',
                key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxmdAa3ymqAjLms43ympXqtyuJnC2bSYh70+5ZZmtyx/MsnGhTEdfbqtsp3BKxHbv0rPd49+Joacm1Shik5/mCppZ0h4I4ISMm983X01H6p/hfAzQYAcnvw/ZQNHAv1QgY9JiuyTBirCDoYB50Fxol/kI/0EviYXuX83KoYpjB0VGP/ssY9ocT//fQUbRmeLDJnciry8y6MduWXHzseOP99axQIjeVsNTE30L4fRN+ppX3aOkG/RFJNx0eI02qbLul3qw5dUuBK5GgMbYftwjHnDoOegnZYFr1sxRO1zsgmxdp/6du75RiDPRJOkPCz2GTrw4CX2FCywbDZlqaIpwqQIDAQAB',
                commands,
            };
        }

        if (browser === 'firefox') {
            permissions = [...permissions, 'contextMenus', 'webRequest', 'webRequestBlocking', 'clipboardWrite'];

            manifest = {
                ...manifest,
                host_permissions: ['<all_urls>'],
                commands,
                browser_specific_settings: {
                    gecko: {
                        id: '{e4b27483-2e73-4762-b2ec-8d988a143a40}',
                        update_url: 'https://killergerbah.github.io/asbplayer/firefox-extension-updates.json',
                    },
                },
            };
        }

        if (browser === 'firefox-android') {
            permissions = [...permissions, 'webRequest', 'webRequestBlocking', 'clipboardWrite'];

            manifest = {
                ...manifest,
                host_permissions: ['<all_urls>'],
                browser_specific_settings: {
                    gecko: {
                        id: '{49de9206-c73e-4829-be4d-bda770d7f4b5}',
                    },
                    gecko_android: {},
                },
            };
        }

        return {
            ...manifest,
            permissions,
        };
    },
});
