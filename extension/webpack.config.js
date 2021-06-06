const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: './src/video.js',
  output: {
    filename: 'video.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "./src",
          globOptions: {
            ignore: ["./src/video.js"],
          }
        },
      ],
      options: {
        concurrency: 100
      }
    }),
  ],
};