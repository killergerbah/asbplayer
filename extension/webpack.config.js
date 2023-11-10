const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const glob = require('glob');

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
        'active-tab-permission-request': './src/active-tab-permission-request.ts',
        asbplayer: './src/asbplayer.ts',
        'background-page': './src/background-page.ts',
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
                loader: 'url-loader?limit=100000',
            },
        ],
    },
    devtool: options.mode === 'development' ? 'source-map' : false,
    resolve: {
        extensions: ['.webpack.js', '.web.js', '.ts', '.tsx', '.js'],
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyPlugin({
            patterns: [
                {
                    from: './src',
                    globOptions: {
                        ignore: ['**/services', '**/handlers', '**/ui'],
                    },
                },
            ],
            options: {
                concurrency: 100,
            },
        }),
    ],
});
