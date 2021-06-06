const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    video: './src/video.js',
    background: './src/background.js',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  devtool: 'cheap-module-source-map',
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "./src",
          globOptions: {
            ignore: ["./src/video.js", "./src/background.js"],
          }
        },
      ],
      options: {
        concurrency: 100
      }
    }),
  ],
};