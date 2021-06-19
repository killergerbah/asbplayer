const { merge } = require('webpack-merge');
const common = require('./webpack.common');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = merge(common, {
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: "./src/manifest.chrome.json",
                    to: "manifest.json"
                },
            ],
        }),
    ],
});