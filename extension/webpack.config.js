const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const glob = require('glob');

const modifyManifestForProduction = (content, options) => {
    if (options.mode !== 'production') {
        return content;
    }

    const manifest = JSON.parse(content.toString());
    const modifiedContentScripts = manifest.content_scripts.map((originalContentScript) => ({
        ...originalContentScript,
        exclude_globs: originalContentScript.exclude_globs?.filter((pattern) => !pattern.includes('localhost')),
        matches: originalContentScript.matches?.filter((pattern) => !pattern.includes('localhost')),
    }));
    const modifiedManifest = { ...manifest, content_scripts: modifiedContentScripts };
    return JSON.stringify(modifiedManifest);
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
        'active-tab-permission-request-ui': './src/active-tab-permission-request-ui.ts',
        'ftue-ui': './src/ftue-ui.ts',
        asbplayer: './src/asbplayer.ts',
        'background-page': './src/background-page.ts',
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
        path: path.resolve(__dirname, 'dist'),
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
                    transform: (content, path) => modifyManifestForProduction(content, options),
                },
            ],
            options: {
                concurrency: 100,
            },
        }),
    ],
});
