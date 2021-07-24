const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = (env, options) => ({
  entry: {
    video: './src/video.js',
    background: './src/background.js',
    popup: './src/popup.js',
    'anki-ui': './src/anki-ui.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        include: [
          path.resolve(__dirname, "./src/ui")
        ],
        use: {
          loader: 'babel-loader',
        },
      }
    ],
  },
  devtool: options.mode === 'development' ? 'cheap-module-source-map' : false,
  plugins: [
    new CleanWebpackPlugin(),
    new CopyPlugin({
      patterns: [
        {
          from: "./src",
          globOptions: {
            ignore: [
                "**/services",
                "**/handlers",
                "**/ui"
            ],
          }
        },
      ],
      options: {
        concurrency: 100
      }
    }),
  ],
});