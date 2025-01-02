# Notes for reviewers

## Building

Environment:

```
node 18.12.1
npm 8.19.2
yarn 3.2.0
```

```
# Install yarn
npm install --global yarn

# Make sure you're on yarn 3
yarn set version 3.2.0

# Install dependencies
yarn

# Build production Firefox version of the extension to extension/dist/firefoxandroid
# Zip package is saved to extension/dist/asbplayer-extension-<version>-firefoxandroid.zip
yarn workspace @project/extension run packageProdFirefoxAndroid
```
