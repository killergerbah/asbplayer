const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { DefinePlugin } = require('webpack');
const glob = require('glob');

const manifestWithoutLocalhostPatterns = (manifest) => {
    const modifiedContentScripts = manifest.content_scripts.map((originalContentScript) => ({
        ...originalContentScript,
        exclude_globs: originalContentScript.exclude_globs?.filter((pattern) => !pattern.includes('localhost')),
        matches: originalContentScript.matches?.filter((pattern) => !pattern.includes('localhost')),
    }));
    return { ...manifest, content_scripts: modifiedContentScripts };
};

const manifestModifiedForFirefox = (manifest) => {
    delete manifest['minimum_chrome_version'];
    delete manifest['key'];
    delete manifest['side_panel'];
    return {
        ...manifest,
        host_permissions: ['<all_urls>'],
        permissions: ['tabs', 'storage', 'contextMenus'],
        background: {
            scripts: ['background.js'],
        },
    };
};

const modifyManifest = (content, env, options) => {
    let manifest = JSON.parse(content.toString());

    if (env.firefox) {
        manifest = manifestModifiedForFirefox(manifest);
    }

    if (options.mode === 'production') {
        manifest = manifestWithoutLocalhostPatterns(manifest);
    }

    return JSON.stringify(manifest);
};

module.exports = (env, options) => ({
    entry: {
        video: './src/video.ts',
        page: './src/page.ts',
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
        asbplayer: './src/asbplayer.ts',
        'offscreen-audio-recorder': './src/offscreen-audio-recorder.ts',
        'mp3-encoder-worker': '../common/audio-clip/mp3-encoder-worker.ts',
        'pgs-parser-worker': '../common/subtitle-reader/pgs-parser-worker.ts',
        ...Object.fromEntries(
            glob
                .sync('./src/pages/*.ts')
                .map((filePath) => [filePath.substring(filePath.lastIndexOf('/pages'), filePath.length - 3), filePath])
        ),
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, env.firefox ? 'dist/firefox' : 'dist/chromium'),
    },
    module: {
        rules: [
            { test: /\.tsx?$/, loader: 'ts-loader' },
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                include: [path.resolve(__dirname, './src/ui')],
                use: {
                    loader: 'babel-loader',
                },
            },
            { test: /\.js$/, loader: 'source-map-loader' },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.(woff|woff2)$/,
                type: 'asset/inline',
            },
        ],
    },
    devtool: options.mode === 'development' ? 'source-map' : false,
    resolve: {
        extensions: ['.webpack.js', '.web.js', '.ts', '.tsx', '.js'],
        fallback: {
            url: require.resolve('url/'),
        },
    },
    plugins: [
        new CleanWebpackPlugin(),
        new DefinePlugin({ FIREFOX: JSON.stringify(env.firefox) }),
        new CopyPlugin({
            patterns: [
                {
                    from: './src',
                    globOptions: {
                        ignore: [
                            '**/services',
                            '**/handlers',
                            '**/ui',
                            '**/.DS_Store',
                            '**/controllers',
                            '**/*.ts',
                            '**/manifest.json',
                        ],
                    },
                },
                {
                    from: '../common/locales',
                    to: 'asbplayer-locales',
                },
                {
                    from: './src/manifest.json',
                    to: 'manifest.json',
                    transform: (content, path) => modifyManifest(content, env, options),
                },
            ],
            options: {
                concurrency: 100,
            },
        }),
    ],
});
